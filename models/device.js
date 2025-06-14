module.exports = (sequelize, DataTypes) => {
  const Device = sequelize.define('Device', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    last_seen: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive'),
      defaultValue: 'active'
    },
    sleep_interval: {
      type: DataTypes.INTEGER,
      defaultValue: 60
    },
    sleep_interval_updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'last_seen',
    tableName: 'devices'
  });

  Device.associate = models => {
    Device.hasMany(models.Location, {
      foreignKey: 'device_id',
      onDelete: 'CASCADE'
    });
  };

  return Device;
}; 