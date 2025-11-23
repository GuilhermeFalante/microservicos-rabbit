const amqp = require('amqplib');

require('dotenv').config();

const RABBIT_URL = process.env.RABBITMQ_URL;

let connection = null;
let channel = null;

async function connect() {
  if (channel && connection) return { connection, channel };

  try {
    connection = await amqp.connect(RABBIT_URL);
    channel = await connection.createChannel();
    
    await channel.assertExchange('shopping_events', 'topic', { durable: true });
    console.log('[shared/rabbitmq] Connected to RabbitMQ at', RABBIT_URL);
    connection.on('error', (err) => {
      console.error('[shared/rabbitmq] connection error', err.message);
      connection = null;
      channel = null;
    });
    connection.on('close', () => {
      console.warn('[shared/rabbitmq] connection closed');
      connection = null;
      channel = null;
    });
    return { connection, channel };
  } catch (error) {
    console.error('[shared/rabbitmq] failed to connect:', error.message);
    connection = null;
    channel = null;
    throw error;
  }
}

async function publish(exchange, routingKey, message, options = { persistent: true }) {
  try {
    if (!channel) {
      await connect();
    }

    if (!channel) {
      throw new Error('No RabbitMQ channel available');
    }

    const payload = Buffer.from(JSON.stringify(message));
    channel.publish(exchange, routingKey, payload, options);
    console.log(`[shared/rabbitmq] published to exchange=${exchange} routingKey=${routingKey}`);
    return true;
  } catch (error) {
    console.error('[shared/rabbitmq] publish failed:', error.message);
    return false;
  }
}

module.exports = {
  connect,
  publish,
  get url() { return RABBIT_URL; }
};
