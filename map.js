
        document.addEventListener('DOMContentLoaded', function() {
            // Find the map container and get its attributes
            const mapContainer = document.querySelector('div[id^="map_"]');
            if (!mapContainer) {
                console.error('Map container not found');
                return;
            }

            const mapId = mapContainer.id;
            const centerLat = parseFloat(mapContainer.getAttribute('data-center-lat'));
            const centerLng = parseFloat(mapContainer.getAttribute('data-center-lng'));

            fetch('../markers_data.json')
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok: ' + response.statusText);
                    }
                    return response.json();
                })
                .then(markersData => {
                    var map = L.map(mapId).setView([centerLat, centerLng], 7);
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    }).addTo(map);

                    var hardwareGroups = {};
                    var featureGroups = {};
                    var markerLayers = {};

                    // Group markers by hardware type
                    markersData.forEach(marker => {
                        if (!hardwareGroups[marker.hardware]) {
                            hardwareGroups[marker.hardware] = [];
                        }
                        hardwareGroups[marker.hardware].push(marker);
                    });

                    // Create feature groups for each hardware type
                    Object.keys(hardwareGroups).forEach(hardware => {
                        featureGroups[hardware] = L.featureGroup().addTo(map);
                        markerLayers[hardware] = [];
                    });

                    // Add layer control
                    var layerControl = L.control.layers(null, null, {collapsed: false, position: 'topright'}).addTo(map);
                    layerControl._container.classList.add('custom-layer-control');

                    var overlaysHtml = '<div class="leaflet-control-layers-overlays">';
                    Object.keys(hardwareGroups).forEach((hardware, idx) => {
                        overlaysHtml += `
                            <label>
                                <input type="checkbox" id="layer-${idx}" class="leaflet-control-layers-selector" name="${hardware}" checked>
                                <span>
                                    <img src="${hardwareGroups[hardware][0].iconUrl}" width="24" height="24" style="vertical-align: middle; margin-right: 5px;">
                                    ${hardware}
                                </span>
                            </label>`;
                    });
                    overlaysHtml += '</div>';
                    layerControl._container.querySelector('.leaflet-control-layers-list').insertAdjacentHTML('beforeend', overlaysHtml);

                    // Add event listeners for layer control
                    setTimeout(function() {
                        var checkboxes = layerControl._container.querySelectorAll('.leaflet-control-layers-selector');
                        checkboxes.forEach((checkbox, idx) => {
                            var hardware = Object.keys(hardwareGroups)[idx];
                            checkbox.addEventListener('change', function() {
                                if (this.checked) map.addLayer(featureGroups[hardware]);
                                else map.removeLayer(featureGroups[hardware]);
                            });
                        });
                    }, 100);

                    // Time filter functionality
                    var timeFilter = document.getElementById('time-filter');
                    var currentTime = Math.floor(Date.now() / 1000);

                    function updateMarkers() {
                        var hours = timeFilter.value === 'all' ? Infinity : parseInt(timeFilter.value) * 3600;
                        var timeThreshold = hours === Infinity ? 0 : currentTime - hours;

                        // Clear existing markers
                        Object.keys(markerLayers).forEach(function(hardware) {
                            markerLayers[hardware].forEach(function(marker) {
                                map.removeLayer(marker);
                            });
                            markerLayers[hardware] = [];
                        });

                        // Add markers based on time filter
                        markersData.forEach(marker => {
                            if (marker.epochTime < timeThreshold && marker.epochTime !== 0) {
                                return;
                            }

                            var markerOptions = { zIndexOffset: 1000 };
                            if (marker.iconUrl) {
                                markerOptions.icon = L.icon({
                                    iconUrl: marker.iconUrl,
                                    iconSize: [48, 48],
                                    iconAnchor: [24, 48],
                                    popupAnchor: [0, -48],
                                    tooltipAnchor: [24, -24]
                                });
                            } else {
                                markerOptions.icon = new L.Icon.Default();
                                markerOptions.icon.options.iconUrl = 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-' + marker.color + '.png';
                            }
                            var circleMarker = L.marker([marker.lat, marker.lng], markerOptions);
                            circleMarker.bindPopup(marker.popup);
                            circleMarker.bindTooltip(marker.tooltip, { sticky: true });
                            circleMarker.addTo(featureGroups[marker.hardware]);
                            markerLayers[marker.hardware].push(circleMarker);
                        });

                        // Fit map to bounds of visible markers
                        var allBounds = [];
                        markersData.forEach(marker => {
                            if (marker.epochTime >= timeThreshold || marker.epochTime === 0) {
                                allBounds.push([marker.lat, marker.lng]);
                            }
                        });
                        if (allBounds.length > 0) {
                            map.fitBounds(allBounds);
                        }
                    }

                    // Initial marker display
                    updateMarkers();

                    // Add event listener for time filter
                    timeFilter.addEventListener('change', updateMarkers);
                })
                .catch(error => {
                    console.error('Error loading markers:', error);
                    alert('Failed to load markers_data.json. Please ensure the file exists and is accessible. This may happen if you are opening the HTML file directly (file://). Try serving the file through a local web server (e.g., using "python -m http.server 8000"). Error: ' + error.message);
                });
        });
        