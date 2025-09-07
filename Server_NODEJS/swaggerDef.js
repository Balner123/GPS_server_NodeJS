const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'GPS Tracking Server API',
      version: '1.0.0',
      description: 'API documentation for the GPS Tracking Server, providing endpoints for user authentication, device management, and data handling.',
    },
    servers: [
      {
        url: 'http://localhost:5000', // The development server
        description: 'Development server'
      },
    ],
    components: {
        securitySchemes: {
            cookieAuth: {
                type: 'apiKey',
                in: 'cookie',
                name: 'connect.sid' // Name of the session cookie
            }
        }
    },
    security: [
        {
            cookieAuth: []
        }
    ]
  },
  // Path to the API docs
  apis: ['./routes/*.js'], // Look for JSDoc comments in all .js files in the routes directory
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
