package com.example.gpsreporterapp

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query

@Dao
interface LocationDao {
    @Insert
    suspend fun insertLocation(location: CachedLocation)

    @Query("SELECT * FROM location_cache ORDER BY timestamp ASC")
    suspend fun getAllCachedLocations(): List<CachedLocation>

    @Query("SELECT * FROM location_cache ORDER BY timestamp ASC LIMIT :limit")
    suspend fun getLocationsBatch(limit: Int): List<CachedLocation>

    @Query("DELETE FROM location_cache WHERE id IN (:locationIds)")
    suspend fun deleteLocationsByIds(locationIds: List<Int>)
}
