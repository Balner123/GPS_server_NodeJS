package com.example.gpsreporterapp

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Singleton repository to hold the global state of the LocationService.
 *
 * This allows different parts of the app (like MainActivity) to observe the service's
 * status in a lifecycle-aware and decoupled manner, replacing the need for LocalBroadcastManager.
 */
object ServiceStateRepository {

    // The private mutable state flow that can be updated only from within the repository.
    private val _serviceState = MutableStateFlow(ServiceState())

    // The public, read-only state flow that external components can collect.
    val serviceState = _serviceState.asStateFlow()

    /**
     * Updates the current service state.
     * This should typically be called by the LocationService.
     */
    fun updateState(newState: ServiceState) {
        _serviceState.tryEmit(newState)
    }
}
