const amqp = require('amqplib');
const axios = require('axios');
const serviceRegistry = require('../shared/serviceRegistry');
const auth = require('../auth-token.json');

const RABBIT_URL = 'amqps://nfhlhile:RLUSdDZdJAJzG1UG734lLSgerfPPVYyL@jackal.rmq.cloudamqp.com/nfhlhile';
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

          try {
            const resp = await axios.get(`http://localhost:3000/api/users/${payload.userId}`, {
              headers: {
                Authorization: `Bearer ${auth.token}`
              }
            });
            email = resp.data.data.email;
          } catch (err) {
            console.log(`Erro!`);
          }

        console.log(`Enviando comprovante da lista ${payload.id} para o usuário ${email}`);
        ch.ack(msg);
      } catch (err) {
        console.error('[Notification Worker] Erro ao processar mensagem:', err.message);
        ch.nack(msg, false, false);
      }
    });
  } catch (error) {
    console.error('[Notification Worker] Falha ao conectar/consumir:', error.message);
    process.exit(1);
  }
}

start();
