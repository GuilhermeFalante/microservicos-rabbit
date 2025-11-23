const amqp = require('amqplib');
const serviceRegistry = require('../shared/serviceRegistry');

const RABBIT_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const EXCHANGE = 'shopping_events';
const BINDING_KEY = 'list.checkout.#';

function calcTotalFromItems(items) {
  if (!items || !Array.isArray(items)) return 0;
  return items.reduce((sum, it) => sum + ((it.estimatedPrice || 0) * (it.quantity || 0)), 0);
}

async function start() {
  try {
    const conn = await amqp.connect(RABBIT_URL);
    const ch = await conn.createChannel();
    await ch.assertExchange(EXCHANGE, 'topic', { durable: true });

    const q = await ch.assertQueue('', { exclusive: true });
    await ch.bindQueue(q.queue, EXCHANGE, BINDING_KEY);

    console.log('[Analytics Worker] Aguardando mensagens em', q.queue);

    ch.consume(q.queue, async (msg) => {
      if (!msg) return;
      try {
        const payload = JSON.parse(msg.content.toString());
        // Calcular total gasto
        let total = 0;
        if (payload.summary && payload.summary.estimatedTotal) {
          total = payload.summary.estimatedTotal;
        } else {
          total = calcTotalFromItems(payload.items);
        }

        console.log(`[Analytics Worker] Lista ${payload.id} total gasto R$ ${total.toFixed(2)} - atualizando dashboard (simulado)`);

        // Simular trabalho pesado (não bloquear o loop de eventos)
        // poderia enviar para um DB ou outro serviço

        ch.ack(msg);
      } catch (err) {
        console.error('[Analytics Worker] Erro ao processar mensagem:', err.message);
        ch.nack(msg, false, false);
      }
    });
  } catch (error) {
    console.error('[Analytics Worker] Falha ao conectar/consumir:', error.message);
    process.exit(1);
  }
}

start();
