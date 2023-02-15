import Fastify  from "fastify";
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
//import fastifyEnv from "@fastify/env";
import { appRoutes } from "./lib/routes";

const app = Fastify()



app.register(cors)
//colocar o endereço de produção com origin:
app.register(appRoutes)

const schema = {
  type: 'object',
  required: ['SECRET_JWT'],
  properties: {
    SECRET_JWT: {
      type: 'string'
    }
  }
}

const options = {
  confKey: 'config',
  dotenv: true,
  schema: schema,
  data: process.env
}

const jwtsecret = options.data.SECRET_JWT as string

app.register(jwt, {
  secret: jwtsecret
})


app.listen({
  port: 3333,
  host: "0.0.0.0",
}).then(() => {
  console.log('HTTP Server running!!')
})
