module.exports = (sequelize, DataTypes) => {
  const Device = sequelize.define('Device', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    device_id: {
      type: DataTypes.STRING(10),
      allowNull: false,
      unique: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    last_seen: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive'),
      defaultValue: 'active'
    },
    interval_gps: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 60 // Default: 60 seconds between GPS fixes
    },
    interval_send: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1 // Default: Send after every 1 cycle (simple mode)
    },
    geofence: {
      type: DataTypes.JSON,
      allowNull: true
    }
  }, {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    tableName: 'devices'
  });

  Device.associate = models => {
    Device.hasMany(models.Location, {
      foreignKey: 'device_id',
      onDelete: 'CASCADE'
    });
    Device.hasMany(models.Alert, {
      foreignKey: 'device_id',
      onDelete: 'CASCADE'
    });
    Device.belongsTo(models.User, {
      foreignKey: 'user_id'
    });
  };

  return Device;
}; 