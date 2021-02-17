# MetnoWeather
Plug-in for HomeRemote providing weather information from met.no API.

# Features
Reads seven days weather forecast from met.no (The Norwegian Meteorological Institute) based on given latitude, longitude and altitude. Saves weekday name, forecasted temperature and icon name for each seven coming days.

Temperature is average temperature for a whole day. Weather icon is taken from the nearest datapoint of noon time. Note that plugin uses local time of the device where it is running.

# Settings

In the settings give latitude, longitude and altitude.

# Usage
Import plugin code to HomeRemote project.

Import icon pictures in png format to HomeRemote project. Icons can be downloaded from link below.

The plugin uses following attributes to store data:
>    "temperature_now", "weekday_now", "symbol_now", "airpressure_now", "cloudareafraction_now", "humidity_now", "winddirection_now", "windspeed_now",
>    "temperature1","temperature2","temperature3","temperature4","temperature5","temperature6","temperature7",
>    "weekday1","weekday2","weekday3","weekday4","weekday5","weekday6","weekday7",
>    "symbol1","symbol2","symbol3","symbol4","symbol5","symbol6","symbol7"

"_now" variables are for current conditions. Number 1 variables are for following day (tomorrow) and then for each following day 2,3...7.

# Links

[met.no API](https://api.met.no/)

[met.no weather icons](https://api.met.no/weatherapi/weathericon/2.0/documentation)
