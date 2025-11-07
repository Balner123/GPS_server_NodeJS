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
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    last_seen: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    power_status: {
      type: DataTypes.ENUM('ON', 'OFF'),
      allowNull: false,
      defaultValue: 'ON'
    },
    power_instruction: {
      type: DataTypes.ENUM('NONE', 'TURN_OFF'),
      allowNull: false,
      defaultValue: 'NONE'
    },
    interval_gps: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 60 // Default: 60 seconds
    },
    interval_send: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1 // Default: Send after every 1 cycle (simple mode)
    },
    mode: {
      type: DataTypes.ENUM('simple', 'batch'),
      allowNull: false,
      defaultValue: 'simple'
    },
    satellites: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 7
    },
    geofence: {
      type: DataTypes.JSON,
      allowNull: true
    },
    geofence_alert_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    device_type: {
      type: DataTypes.STRING(10),
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    tableName: 'devices'
  });

  Device.associate = models => {
    Device.hasMany(models.Location, {
      foreignKey: 'device_id'
    });
    Device.hasMany(models.Alert, {
      foreignKey: 'device_id'
    });
    Device.belongsTo(models.User, {
      foreignKey: 'user_id',
      onDelete: 'CASCADE'
    });
  };

  return Device;
};