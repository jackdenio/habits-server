import { FastifyInstance } from "fastify"
import { prisma } from "./prisma"
import { z } from "zod"
import dayjs from 'dayjs'
import fetch from "node-fetch"
import { authenticate } from "../plugins/authenticate"

export async function appRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    const habits = await prisma.habit.findMany()
    return habits
  }) 

  //create habits
  app.post('/habits/create', async(request) => {

    const createHabitBody = z.object({
      title: z.string(),
      weekDays: z.array(
        z.number().min(0).max(6)
      )
    })

    const { title, weekDays } = createHabitBody.parse(request.body)

    const today = dayjs().startOf('day').toDate()

    try {

      await request.jwtVerify()

      await prisma.habit.create({
        data: {
          title,
          ownerId: request.user.sub,
          created_at: today,
          weekDays: {
            create: weekDays.map(weekDay => {
              return {
                week_day: weekDay,
              }
  
            })
          }
        }
      })      

      
    } catch (error) {
      return (error)
    }

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

