package com.example.gpsreporterapp

enum class PowerState {
    ON,
    OFF;

    companion object {
        fun fromString(value: String?): PowerState {
            return when (value?.uppercase()) {
                "ON" -> ON
                "OFF" -> OFF
                else -> OFF
            }
        }
    }

    override fun toString(): String {
        return name
    }
}
