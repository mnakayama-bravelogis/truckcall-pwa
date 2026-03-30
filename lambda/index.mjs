import webpush from 'web-push';
import { DynamoDBClient, ScanCommand, PutItemCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';

const dynamo = new DynamoDBClient({});
const TABLE = process.env.TABLE_NAME;

webpush.setVapidDetails(
  'mailto:admin@example.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

function ok(body, contentType = 'text/plain') {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}

function err(statusCode, message) {
  return {
    statusCode,
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: message,
  };
}

export const handler = async (event) => {
  const path = event.rawPath;
  const method = event.requestContext?.http?.method ?? 'GET';

  // CORS preflight
  if (method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: '',
    };
  }

  // GET /vapid-public-key
  if (path === '/vapid-public-key' && method === 'GET') {
    return ok(process.env.VAPID_PUBLIC_KEY);
  }

  // POST /subscribe
  if (path === '/subscribe' && method === 'POST') {
    let body;
    try {
      body = JSON.parse(event.body ?? '{}');
    } catch {
      return err(400, 'Invalid JSON');
    }

    const sub = body.subscription;
    if (!sub?.endpoint) return err(400, 'Missing subscription.endpoint');

    await dynamo.send(new PutItemCommand({
      TableName: TABLE,
      Item: {
        endpoint: { S: sub.endpoint },
        subscription: { S: JSON.stringify(sub) },
        createdAt: { S: new Date().toISOString() },
      },
    }));

    return ok(JSON.stringify({ ok: true }), 'application/json');
  }

  // POST /notify
  if (path === '/notify' && method === 'POST') {
    const message = event.body ?? '呼び出しがあります';

    const { Items = [] } = await dynamo.send(new ScanCommand({ TableName: TABLE }));

    const payload = JSON.stringify({
      title: 'TruckCALL',
      message,
    });

    const results = await Promise.allSettled(
      Items.map(async (item) => {
        const sub = JSON.parse(item.subscription.S);
        try {
          await webpush.sendNotification(sub, payload);
        } catch (e) {
          // 410 Gone or 404: subscription expired → delete
          if (e.statusCode === 410 || e.statusCode === 404) {
            await dynamo.send(new DeleteItemCommand({
              TableName: TABLE,
              Key: { endpoint: { S: sub.endpoint } },
            }));
          } else {
            throw e;
          }
        }
      })
    );

    const failed = results.filter(r => r.status === 'rejected').length;
    return ok(JSON.stringify({ sent: Items.length, failed }), 'application/json');
  }

  return err(404, 'Not Found');
};
