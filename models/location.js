module.exports = (sequelize, DataTypes) => {
  const Location = sequelize.define('Location', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    device_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    longitude: {
      type: DataTypes.DECIMAL(10, 6),
      allowNull: false
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 6),
      allowNull: false
    },
    speed: DataTypes.DECIMAL(5, 2),
    altitude: DataTypes.DECIMAL(7, 2),
    accuracy: DataTypes.DECIMAL(5, 2),
    satellites: DataTypes.INTEGER
  }, {
    timestamps: true,
    createdAt: 'timestamp',
    updatedAt: false,
    tableName: 'locations'
  });

  Location.associate = models => {
    Location.belongsTo(models.Device, {
      foreignKey: 'device_id'
    });
  };

  return Location;
}; 