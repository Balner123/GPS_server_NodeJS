package com.example.gpsreporterapp

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(entities = [CachedLocation::class], version = 2)
abstract class AppDatabase : RoomDatabase() {
    abstract fun locationDao(): LocationDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        private val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE location_cache ADD COLUMN powerStatus TEXT NOT NULL DEFAULT 'OFF'")
            }
        }

        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "gps_reporter_database"
                ).addMigrations(MIGRATION_1_2).build()
                INSTANCE = instance
                instance
            }
        }
    }
}
