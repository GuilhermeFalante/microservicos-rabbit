const amqp = require('amqplib');
const axios = require('axios');
const serviceRegistry = require('../shared/serviceRegistry');

const RABBIT_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const EXCHANGE = 'shopping_events';
const BINDING_KEY = 'list.checkout.#';

async function start() {
  try {
    const conn = await amqp.connect(RABBIT_URL);
    const ch = await conn.createChannel();
    await ch.assertExchange(EXCHANGE, 'topic', { durable: true });

    const q = await ch.assertQueue('', { exclusive: true });
    await ch.bindQueue(q.queue, EXCHANGE, BINDING_KEY);

    console.log('[Notification Worker] Aguardando mensagens em', q.queue);

    ch.consume(q.queue, async (msg) => {
      if (!msg) return;
      try {
        const payload = JSON.parse(msg.content.toString());
        let email = payload.userEmail;

        // Tentar buscar email no user-service via service registry
        if (!email) {
          try {
            const userService = serviceRegistry.discover('user-service');
            const resp = await axios.get(`${userService.url}/users/${payload.userId}`);
            email = resp.data.email || payload.userId;
          } catch (err) {
            email = payload.userId; // fallback
          }
        }

        console.log(`Enviando comprovante da lista ${payload.id} para o usuário ${email}`);
        ch.ack(msg);
      } catch (err) {
        console.error('[Notification Worker] Erro ao processar mensagem:', err.message);
        // rejeitar e descartar
        ch.nack(msg, false, false);
      }
    });
  } catch (error) {
    console.error('[Notification Worker] Falha ao conectar/consumir:', error.message);
    process.exit(1);
  }
}

start();
