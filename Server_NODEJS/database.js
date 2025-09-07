const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    logging: false,
  }
);

sequelize.authenticate()
  .then(() => {
    console.log('Connection has been established successfully with Sequelize.');
  })
  .catch(err => {
    console.error('Unable to connect to the database with Sequelize:', err);
  });

const User = require('./models/user')(sequelize, Sequelize);
const Device = require('./models/device')(sequelize, Sequelize);
const Location = require('./models/location')(sequelize, Sequelize);

// Definice asociací
User.hasMany(Device, { foreignKey: 'user_id', as: 'devices', onDelete: 'CASCADE' });
Device.belongsTo(User, { foreignKey: 'user_id' });

Device.hasMany(Location, { foreignKey: 'device_id', onDelete: 'CASCADE' });
Location.belongsTo(Device, { foreignKey: 'device_id' });

module.exports = {
  sequelize,
  Sequelize,
  User,
  Device,
  Location,
};