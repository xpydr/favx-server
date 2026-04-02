import Fastify from 'fastify'
import cors from '@fastify/cors'
import { supabase } from './lib/supabase.js'

const fastify = Fastify({
  logger: true
})

await fastify.register(cors, { origin: true })

fastify.get('/', async function handler (request, reply) {
  return { hello: 'world' }
})

fastify.post('/redeem', async function handler (request, reply) {
  const body = request.body ?? {}
  const userId = body.user_id
  const rewardId = body.reward_id

  if (
    userId === undefined ||
    userId === null ||
    rewardId === undefined ||
    rewardId === null ||
    String(userId).trim() === '' ||
    String(rewardId).trim() === ''
  ) {
    return reply.code(400).send({
      ok: false,
      code: 'VALIDATION_ERROR',
      message: 'user_id and reward_id are required'
    })
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('credit_balance')
    .eq('user_id', userId)
    .maybeSingle()

  if (profileError) {
    fastify.log.error(profileError)
    return reply.code(500).send({
      ok: false,
      code: 'DATABASE_ERROR',
      message: profileError.message
    })
  }

  if (!profile) {
    return reply.code(404).send({
      ok: false,
      code: 'PROFILE_NOT_FOUND'
    })
  }

  const { data: reward, error: rewardError } = await supabase
    .from('rewards')
    .select('price_credits, quantity_available')
    .eq('id', rewardId)
    .maybeSingle()

  if (rewardError) {
    fastify.log.error(rewardError)
    return reply.code(500).send({
      ok: false,
      code: 'DATABASE_ERROR',
      message: rewardError.message
    })
  }

  if (!reward) {
    return reply.code(404).send({
      ok: false,
      code: 'REWARD_NOT_FOUND'
    })
  }

  const creditBalance = Number(profile.credit_balance)
  const priceCredits = Number(reward.price_credits)
  const quantityAvailable = Number(reward.quantity_available)

  if (creditBalance <= priceCredits) {
    return reply.code(409).send({
      ok: false,
      code: 'INSUFFICIENT_CREDITS'
    })
  }

  if (quantityAvailable <= 0) {
    return reply.code(409).send({
      ok: false,
      code: 'OUT_OF_STOCK'
    })
  }

  const newBalance = creditBalance - priceCredits
  const newQuantity = quantityAvailable - 1

  const { error: updateProfileError } = await supabase
    .from('profiles')
    .update({ credit_balance: newBalance })
    .eq('user_id', userId)

  if (updateProfileError) {
    fastify.log.error(updateProfileError)
    return reply.code(500).send({
      ok: false,
      code: 'DATABASE_ERROR',
      message: updateProfileError.message
    })
  }

  const { error: updateRewardError } = await supabase
    .from('rewards')
    .update({ quantity_available: newQuantity })
    .eq('id', rewardId)

  if (updateRewardError) {
    fastify.log.error(updateRewardError)
    return reply.code(500).send({
      ok: false,
      code: 'DATABASE_ERROR',
      message: updateRewardError.message
    })
  }

  const totalPrice = priceCredits * 1

  const { data: redemption, error: insertError } = await supabase
    .from('reward_redemptions')
    .insert({
      user_id: userId,
      reward_id: rewardId,
      quantity: 1,
      total_price: totalPrice,
      status: 'pending'
    })
    .select()
    .single()

  if (insertError) {
    fastify.log.error(insertError)
    return reply.code(500).send({
      ok: false,
      code: 'DATABASE_ERROR',
      message: insertError.message
    })
  }

  return { ok: true, redemption }
})

const port = Number(process.env.PORT) || 3000

try {
  await fastify.listen({ port, host: '0.0.0.0' })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
