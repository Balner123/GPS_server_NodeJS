module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false
    },
    is_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    action_token: {
      type: DataTypes.STRING,
      allowNull: true
    },
    action_token_expires: {
      type: DataTypes.DATE,
      allowNull: true
    },
    action_type: {
      type: DataTypes.STRING, // 'VERIFY_EMAIL', 'RESET_PASSWORD', 'DELETE_ACCOUNT'
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    pending_email: {
      type: DataTypes.STRING,
      allowNull: true
    },
    provider: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'local'
    },
    provider_id: {
      type: DataTypes.STRING,
      allowNull: true
    },
    provider_data: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'users',
    timestamps: false
  });

  User.associate = models => {
    User.hasMany(models.Device, {
      foreignKey: 'user_id',
      as: 'devices'
      // onDelete: 'CASCADE' // This is now handled in Device.belongsTo
    });
  };

  return User;
};