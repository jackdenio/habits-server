import { PrismaClient } from "@prisma/client";
import Fastify  from "fastify";
import cors from '@fastify/cors'

const app = Fastify()
const prisma = new PrismaClient()

app.register(cors)
//colocar o endereço de produção com origin:


app.get('/', () => {
  return 'hello world'
})

app.listen({
  port: 3333,
}).then(() => {
  console.log('HTTP Server running!!')
})
