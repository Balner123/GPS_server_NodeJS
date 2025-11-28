const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const logger = require('./utils/logger');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    benchmark: true,
    logging: (sql, timing) => {
      logger.sql(sql, { durationMs: timing });
    },
  }
);

sequelize.authenticate()
  .then(() => {
    logger.info('Sequelize connection established');
  })
  .catch(err => {
    logger.error('Unable to connect to the database with Sequelize', err);
  });

const db = {};

// Read all model files from the models directory
fs.readdirSync(path.join(__dirname, 'models'))
  .filter(file => file.indexOf('.') !== 0 && file.slice(-3) === '.js')
  .forEach(file => {
    const model = require(path.join(__dirname, 'models', file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

// Associate models if they have an 'associate' method
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

// Sync database schema
const syncOptions = process.env.NODE_ENV === 'production' ? {} : { alter: true };
sequelize.sync(syncOptions).then(() => {
  logger.info('Database schema synchronized', { env: process.env.NODE_ENV, options: syncOptions });
}).catch(err => {
  logger.error('Error synchronizing database schema', err);
});

module.exports = db;
