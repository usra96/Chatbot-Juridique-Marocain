const request = require('supertest');
const nock = require('nock');
const app = require('../app');

describe('Integration /chat', () => {
  beforeAll(() => {
    process.env.OLLAMA_URL = 'http://localhost:11434/api/generate';
    process.env.FORCE_REBUILD_VECTOR_STORE = 'true';
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it('repond avec un message IA', async () => {
    nock('http://localhost:11434')
      .post('/api/generate')
      .reply(200, { response: 'Reponse de test.' });

    const response = await request(app)
      .post('/chat')
      .send({ message: 'Bonjour' })
      .expect(200);

    expect(response.body).toHaveProperty('reply');
  });
});
