const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
  }
);

sequelize.authenticate()
  .then(() => {
    console.log('Connection has been established successfully with Sequelize.');
  })
  .catch(err => {
    console.error('Unable to connect to the database with Sequelize:', err);
  });

const db = {};
db.Sequelize = Sequelize;
db.sequelize = sequelize;

// Dynamically load models
const fs = require('fs');
const path = require('path');
const basename = path.basename(__filename);

fs
  .readdirSync(path.join(__dirname, 'models'))
  .filter(file => {
    return (file.indexOf('.') !== 0) && (file !== basename) && (file.slice(-3) === '.js');
  })
  .forEach(file => {
    const model = require(path.join(__dirname, 'models', file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

module.exports = db;