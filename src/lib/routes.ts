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

  //toggle habits

  app.patch('/habits/:id/toggle', async (request) => {
    
    const toggleHabitParams = z.object({
      id: z.string().uuid(),
    })

    const { id } = toggleHabitParams.parse(request.params)

    const today = dayjs().startOf('day').toDate()

    let day = await prisma.day.findUnique({
      where: {
        date: today,
      }
    })

    if (!day) {
      day = await prisma.day.create({
        data: {
          date:today,
        }
      })
    }

    //Descompletar
    const dayHabit = await prisma.dayHabit.findUnique({
      where: {
        day_id_habit_id: {
          day_id: day.id,
          habit_id: id,
        }
      }
    })

    if (dayHabit) {
      await prisma.dayHabit.delete({
        where: {
          id: dayHabit.id,
        }
      })
    } else {
      //Completar o hábito
      await prisma.dayHabit.create({
        data: {
          day_id: day.id,
          habit_id: id,
        }
      })

    }

    

  })

  
  //get day of habits
  app.get('/day', async (request) => {
    const getDayParams = z.object({
      date: z.coerce.date()
    })

    const { date } = getDayParams.parse(request.query)
    const parsedDate = dayjs(date).startOf('day')
    const weekDay = parsedDate.get('day')

    const possibleHabits = await prisma.habit.findMany({
      where: {
        created_at: {
          lte: date,
        },
        weekDays: {
          some: {
            week_day: weekDay,
          }
        }
      }
    })

    const day = await prisma.day.findUnique({
      where: {
        date: parsedDate.toDate(),
      },
      include: {
        dayHabits: true,
      }
    })

    const completedHabits = day?.dayHabits.map(dayHabit => {
      return dayHabit.habit_id
    }) ?? []

    return {
      possibleHabits,
      completedHabits
    }

  })

  //summary

  app.get('/summary', async() => {
    const summary = await prisma.$queryRaw`
      SELECT 
        D.id, 
        D.date,
        (
          SELECT 
            cast(count(*) as float)
          FROM day_habits DH
          WHERE DH.day_id = D.id
        ) as completed,
        ( 
          SELECT
            cast(count(*) as float)
          FROM habit_week_days HWD
          JOIN habits H 
            ON H.id = HWD.habit_id
          WHERE 
            HWD.week_day = cast(date_format('%w', D.date/1000.0, 'unixepoch') as int)
            AND H.created_at <= D.date
        ) as amount

      FROM days D
    `
    return summary
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

