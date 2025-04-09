const API_CONFIG = {
    HKO: {
        BASE_URL: 'https://data.weather.gov.hk/weatherAPI/opendata/weather.php',
        DATA_TYPES: {
            CURRENT: 'rhrread',
            FORECAST: 'flw'
        }
    },
    OPENMETEO: {
        BASE_URL: 'https://api.open-meteo.com/v1',
        GEOCODING_URL: 'https://geocoding-api.open-meteo.com/v1/search',
        FORECAST_ENDPOINT: '/forecast'
    }
};

const DOM = {
    globalSearch: document.getElementById('global-search'),
    globalSearchBtn: document.getElementById('global-search-btn'),
    districtSelect: document.getElementById('district-select'),
    searchBtn: document.getElementById('search-btn'),
    cityName: document.getElementById('city-name'),
    temperature: document.getElementById('temperature'),
    weatherDescription: document.getElementById('weather-description'),
    humidity: document.getElementById('humidity'),
    windSpeed: document.getElementById('wind-speed'),
    lastUpdate: document.getElementById('last-update')
};

DOM.globalSearchBtn.addEventListener('click', handleGlobalSearch);
DOM.globalSearch.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleGlobalSearch();
});
DOM.searchBtn.addEventListener('click', handleHKSearch);
DOM.districtSelect.addEventListener('change', handleDistrictChange);

async function handleGlobalSearch() {
    try {
        const city = DOM.globalSearch.value.trim();
        if (!city) {
            alert('Please enter a city name');
            return;
        }

        gtag('event', 'global_weather_search');
        
        const weatherData = await fetchGlobalWeather(city);
        updateUIWithGlobalData(weatherData);
    } catch (error) {
        alert(`Error fetching weather data: ${error.message}`);
    }
}

async function handleHKSearch() {
    try {
        gtag('event', 'hk_weather_refresh');

        const weatherData = await fetchHKWeather();
        populateDistricts(weatherData);
        updateUIWithHKData(weatherData);
    } catch (error) {
        alert(`Error fetching weather data: ${error.message}`);
    }
}

function handleDistrictChange() {
    try {
        const selectedDistrict = DOM.districtSelect.value;
        if (selectedDistrict && window.hkWeatherData) {
            gtag('event', 'hk_weather_change_district');

            updateUIWithHKData(window.hkWeatherData, selectedDistrict);
        }
    } catch (error) {
        alert(`Error updating district: ${error.message}`);
    }
}

async function fetchGlobalCityLocation(city) {
    try {
        const parameters = new URLSearchParams({
            name: city,
            count: 10,
            language: 'en',
            format: 'json'
        }).toString();
        const url = `${API_CONFIG.OPENMETEO.GEOCODING_URL}?${parameters}`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        throw new Error(`Failed to fetch global weather data: ${error.message}`);
    }
}

async function fetchGlobalWeather(city) {
    try {
        const cityData = await fetchGlobalCityLocation(city);
        if (!cityData.hasOwnProperty('results')) {
            throw new Error('City not found');
        }

        const cityFirstResult = cityData['results'][0];
        const parameters = new URLSearchParams({
            latitude: cityFirstResult.latitude,
            longitude: cityFirstResult.longitude,
            current: 'temperature_2m,relative_humidity_2m,wind_speed_10m',
            timezone: 'auto'
        }).toString();
        const url = `${API_CONFIG.OPENMETEO.BASE_URL}${API_CONFIG.OPENMETEO.FORECAST_ENDPOINT}?${parameters}`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const weatherData = {
            name: cityFirstResult.name,
            main: await response.json()
        };
        return weatherData;
    } catch (error) {
        throw new Error(`Failed to fetch global weather data: ${error.message}`);
    }
}

async function fetchHKForecastWeather() {
    try {
        const forecastParameters = new URLSearchParams({
            dataType: API_CONFIG.HKO.DATA_TYPES.FORECAST,
            lang: 'en'
        }).toString();
        const forecastUrl = `${API_CONFIG.HKO.BASE_URL}?${forecastParameters}`;
        const forecastResponse = await fetch(forecastUrl);
        
        if (forecastResponse.ok) {
            return await forecastResponse.json();
        }
    } catch (additionalError) {
        // continue with the main data even if additional data fetch fails
        console.error('Error fetching additional data:', additionalError);
        return;
    }
}

async function fetchHKWeather() {
    try {
        const currentParameters = new URLSearchParams({
            dataType: API_CONFIG.HKO.DATA_TYPES.CURRENT,
            lang: 'en'
        }).toString();
        const currentUrl = `${API_CONFIG.HKO.BASE_URL}?${currentParameters}`;
        
        const currentResponse = await fetch(currentUrl);
        if (!currentResponse.ok) {
            throw new Error(`HTTP error! Status: ${currentResponse.status}`);
        }
        
        const currentData = await currentResponse.json();
        
        const forecastData = await fetchHKForecastWeather();
        currentData.additionalData = forecastData;
        return currentData;
    } catch (error) {
        throw new Error(`Failed to fetch HK weather data: ${error.message}`);
    }
}

function populateDistricts(data) {
    try {
        const districts = [
            'Hong Kong Observatory', 'King\'s Park', 'Wong Chuk Hang', 'Ta Kwu Ling', 
            'Lau Fau Shan', 'Tai Po', 'Sha Tin', 'Tuen Mun', 'Tseung Kwan O', 
            'Sai Kung', 'Cheung Chau', 'Chek Lap Kok', 'Tsing Yi', 'Shek Kong', 
            'Tsuen Wan Ho Koon', 'Tsuen Wan Shing Mun Valley', 'Hong Kong Park', 
            'Shau Kei Wan', 'Kowloon City', 'Happy Valley', 'Wong Tai Sin', 
            'Stanley', 'Kwun Tong', 'Sham Shui Po', 'Kai Tak Runway Park', 
            'Yuen Long Park', 'Tai Mei Tuk'
        ];
        
        districts.forEach((district) => {
            const optionElement = document.createElement('option');
            optionElement.value = district;
            optionElement.textContent = district;

            DOM.districtSelect.appendChild(optionElement);
        });
        
        window.hkWeatherData = data;
    } catch (error) {
        throw new Error(`Failed to populate districts: ${error.message}`);
    }
}

function updateUIWithGlobalData(data) {
    try {
        DOM.cityName.textContent = data.name;
        DOM.temperature.textContent = Math.round(data.main.current.temperature_2m);
        DOM.weatherDescription.textContent = ''; // Open-meteo doesn't have weather description
        DOM.humidity.textContent = `${data.main.current.relative_humidity_2m}${data.main.current_units.relative_humidity_2m}`;
        DOM.windSpeed.textContent = `${data.main.current.wind_speed_10m} ${data.main.current_units.wind_speed_10m}`;
        const updateDate = new Date(data.main.current.time);
        DOM.lastUpdate.textContent = updateDate.toLocaleString();
    } catch (error) {
        throw new Error(`Error updating UI with global data: ${error.message}`);
    }
}

function maybeParseHumidityOrWindSpeed(data) {
    if (!data.additionalData) {
        return;
    }
    if (!data.additionalData.forecastDesc) {
        return;
    }

    const forecastDesc = data.additionalData.forecastDesc;
    
    let humidity = null;
    let windSpeed = null;
    if (!data.humidity) {
        const humidityMatch = forecastDesc.match(/humidity\s+(\d+)%/i);
        if (humidityMatch && humidityMatch[1]) {
            humidity = `${humidityMatch[1]}%`;
        }
    }

    if (!data.wind) {
        const windMatch = forecastDesc.match(/wind\s+(\d+)\s*km\/h/i);
        if (windMatch && windMatch[1]) {
            windSpeed = `${windMatch[1]} km/h`;
        }
    }
    return {humidity, windSpeed};
}

function updateUIWithHKData(data, selectedDistrict = null) {
    try {
        // if no district is selected, use the first one from the dropdown
        if (!selectedDistrict) {
            selectedDistrict = DOM.districtSelect.value;
        }
        
        if (!selectedDistrict) {
            throw new Error('No district selected');
        }
        
        DOM.cityName.textContent = selectedDistrict;

        let tempValue = '--';
        if (data.temperature && data.temperature.data) {
            const tempData = data.temperature.data.find(item => item.place === selectedDistrict);
            if (tempData) {
                tempValue = tempData.value;
            }
        }
        DOM.temperature.textContent = tempValue;

        DOM.weatherDescription.textContent = data.additionalData.generalSituation || '--';
        
        let humidityValue = '--';
        if (data.humidity && data.humidity.data) {
            const humidityData = data.humidity.data.find(item => item.place === selectedDistrict) || data.humidity.data[0];
            if (humidityData) {
                humidityValue = humidityData.value;
            }
        }
        DOM.humidity.textContent = `${humidityValue}%`;
        
        let windValue = '--';
        if (data.wind && data.wind.data) {
            const windData = data.wind.data.find(item => item.place === selectedDistrict) || data.wind.data[0];
            if (windData) {
                windValue = windData.speed;
            }
        }
        DOM.windSpeed.textContent = `${windValue} km/h`;
        
        if (data.updateTime) {
            const updateDate = new Date(data.updateTime);
            DOM.lastUpdate.textContent = updateDate.toLocaleString();
        } else {
            DOM.lastUpdate.textContent = '--';
        }
        
        // if humidity or wind data is not available, we'll try to parse it from the forecast description
        const parsedData = maybeParseHumidityOrWindSpeed(data);
        if (!parsedData) {
            return;
        }

        DOM.humidity.textContent = (parsedData['humidity'] !== null) ? parsedData['humidity'] : DOM.humidity.textContent;
        DOM.windSpeed.textContent = (parsedData['windSpeed'] !== null) ? parsedData['windSpeed'] : DOM.windSpeed.textContent;
    } catch (error) {
        throw new Error(`Error updating UI with HK data: ${error.message}`);
    }
}

window.addEventListener('load', async () => {
    try {
        const weatherData = await fetchHKWeather();
        populateDistricts(weatherData);
        updateUIWithHKData(weatherData);
    } catch (error) {
        alert(`Error initializing weather app: ${error.message}`);
    }
}); 