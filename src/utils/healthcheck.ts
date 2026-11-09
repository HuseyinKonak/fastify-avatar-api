import http from 'http';
import config from '../config/index.js';

const options = {
  host: typeof config.HOST === 'string' ? config.HOST : 'localhost',
  port: typeof config.PORT === 'number' ? config.PORT : 8083,
  path: '/health',
  timeout: 2000,
};

const request = http.request(options, (res) => {
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

request.on('error', () => {
  process.exit(1);
});

request.end();
