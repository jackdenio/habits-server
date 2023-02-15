import { FastifyInstance } from "fastify"
import { prisma } from "./prisma"
import { z } from "zod"
import fetch from "node-fetch"
import { authenticate } from "../plugins/authenticate"

export async function appRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    const habits = await prisma.habit.findMany()
    return habits
  }) 
  
  
  // Users

  app.get('/me', {
    onRequest: [authenticate],
  }, async(request) => {
    return { user: request.user }
  })

  app.post('/users/inup', async(request) => {

    const createUserBody = z.object({
      access_token: z.string(),

    })

    const { access_token } = createUserBody.parse(request.body)

    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${access_token}`,
      }
    })

    const userData = await userResponse.json()

    const userInfoSchema = z.object({
      id: z.string(),
      email: z.string().email(),
      name: z.string(),
      picture: z.string().url(),
    })

    const userInfo = userInfoSchema.parse(userData)

    let user = await prisma.user.findUnique({
      where: {
        googleId: userInfo.id,
      }
    })

    if (!user) {
      user = await prisma.user.create({
        data: {
          googleId: userInfo.id,
          name: userInfo.name,
          email: userInfo.email,
          avatarUrl: userInfo.picture,
        }
      })
    }

    const token = app.jwt.sign({
      name: user.name,
      avatarUrl: user.avatarUrl,
    }, {
      sub: user.id,
      expiresIn: '7 days'
    })

    return { token }

  })
}

