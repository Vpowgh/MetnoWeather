//MetnoWeather Plugin for HomeRemote
//Seven days weather forecast using met.no API
//Weather Data from MET Norway
//Developed by Vpow 2021-

plugin.Name = "MetnoWeather";
plugin.OnChangeRequest = onChangeRequest;
plugin.OnConnect = onConnect;
plugin.OnDisconnect = onDisconnect;
plugin.OnPoll = onPoll;
plugin.OnSynchronizeDevices = onSynchronizeDevices;
plugin.PollingInterval = 900000; //every 15min. met.no TOS: do not poll too often
plugin.DefaultSettings = { "Latitude": "0.0", "Longitude": "0.0","Altitude": "0"};

//info for user agent
var VERSION = "v1.3";
var UALINK = "github.com/Vpowgh/MetnoWeather";
var USERAGENT = "HomeRemote_MetnoWeatherPlugin "+VERSION+" "+UALINK;

//internal copy of settings
var int_settings = {
    latitide: 0,
    longitude: 0,
    altitude: 0
};

var http = new HTTPClient();
var lastModified = "";
var cachedResponse = {};

function onChangeRequest(device, attribute, value) {
}

function onConnect() {
    var lat, lon, alt;
    
    //met.no TOS: max. 4 decimals for coordinates, altitude is integer
    lat = Math.round(plugin.Settings["Latitude"] * 10000) / 10000;
    lon = Math.round(plugin.Settings["Longitude"] * 10000) / 10000;
    alt = Math.round(plugin.Settings["Altitude"]);
    
    //sanity check for coordinates
    if(lat > 90.0) {
        lat = 90.0;
    }
    else if(lat < -90.0) {
        lat = -90.0;
    }

    if(lon > 180.0) {
        lon = 180.0;
    }
    else if(lon < -180.0) {
        lon = -180.0;
    }

    if(alt > 50000.0) {
        alt = 50000.0;
    }
    else if(alt < 0.0) {
        alt = 0.0;
    }
    
    int_settings.latitude = lat;
    int_settings.longitude = lon;
    int_settings.altitude = alt;
}

function onDisconnect() {
}



function onPoll() {
    var httpOptions = {
        headers: {'User-Agent': USERAGENT}, 
        timeout: 10000
    };

    //met.no TOS: use If-Modified-Since header with date from Last-Modified header
    if(lastModified != "") {
        httpOptions.headers["If-Modified-Since"] = lastModified;
    }

    //read weather data from met.no API
    //met.no TOS: must send in user agent application name, version, developer info, must use https
    try {
        var response = http.get("https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=" + int_settings.latitude + "&lon=" + int_settings.longitude +"&altitude=" + int_settings.altitude,httpOptions);
    } catch(err) {
        //other than status 200 responses end up here, since HR treats them as exceptions
        //console.log(err.message);
    }

    if(typeof response != "undefined") { //200 response received, update cache and last modified info
        cachedResponse = JSON.parse(JSON.stringify(response.data));

        if(response.headers["Last-Modified"] != "undefined") {
            lastModified = response.headers["Last-Modified"];
        }
        else {
            lastModified = "";
        }
    }

    var weatherdata = [];
    var datestarts = [];

    //calculate midnight time stamps in local time
    var m = new Date(Date.now());
    var t = new Date(m.getFullYear(), m.getMonth(), m.getDate(), 0, 0, 0);
    //use this if want to show other timezone, add offset relative to local timezone
    //var t = new Date(m.getFullYear(), m.getMonth(), m.getDate(), m.getHours()-11, 0, 0);

    for (i=0; i < 9; i++) {
        datestarts[i] = Date.parse(t); //the first timestamp is last midnight
        t.setDate(t.getDate() + 1);
    }

    var sums = {
        air_pressure_at_sea_level_sum: 0,
        air_temperature_sum: 0,
        cloud_area_fraction_sum: 0,
        relative_humidity_sum: 0,
        wind_from_direction_sum: 0,
        wind_speed_sum: 0
    };
    var datacount;
    var jstart = 0;

    var nowindex = 0;

    //check which datapoints belong to each time window. met.no has more points for first days then less
    for(i=0; i < 8; i++) {

        sums.air_pressure_at_sea_level_sum = 0;
        sums.air_temperature_sum = 0;
        sums.cloud_area_fraction_sum = 0;
        sums.relative_humidity_sum = 0;
        sums.wind_from_direction_sum = 0;
        sums.wind_speed_sum = 0;
        datacount = 0;

        var noontime = datestarts[i] + (datestarts[i+1] - datestarts[i])/2;
        var noonindex = 0;
        var noondiff = 86400000; //24h in ms
        
        var nowdiff = 86400000;
        var datenow = Date.parse(m);

        //collect all temperatures for minmax detection
        var daytemps = [];

        for(j=jstart; j < Object.keys(cachedResponse.properties.timeseries).length; j++) {
            
            dd = Date.parse(cachedResponse.properties.timeseries[j].time);
            
            //check first values which point is closest to now
            if(j<4) {
                var ndiff = Math.abs(dd-datenow);
                if(ndiff < nowdiff) {
                    nowdiff = ndiff;
                    nowindex = j;
                }
            }

            if(dd>datestarts[i+1]) {
                jstart = j;
                break;
            }
            else if(dd>=datestarts[i]) {
                sums.air_pressure_at_sea_level_sum += cachedResponse.properties.timeseries[j].data.instant.details.air_pressure_at_sea_level;
                sums.air_temperature_sum += cachedResponse.properties.timeseries[j].data.instant.details.air_temperature;
                sums.cloud_area_fraction_sum += cachedResponse.properties.timeseries[j].data.instant.details.cloud_area_fraction;
                sums.relative_humidity_sum += cachedResponse.properties.timeseries[j].data.instant.details.relative_humidity;
                sums.wind_from_direction_sum += cachedResponse.properties.timeseries[j].data.instant.details.wind_from_direction;
                sums.wind_speed_sum += cachedResponse.properties.timeseries[j].data.instant.details.wind_speed;
                daytemps.push(cachedResponse.properties.timeseries[j].data.instant.details.air_temperature);
                datacount++;
            }

            //find closest to noon datapoint and use symbol from that
            var ndiff = Math.abs(dd-noontime);
            
            if(ndiff  < noondiff) {
                noondiff = ndiff;
                noonindex = j;
            }
        }

        //take averages as daily values
        if(datacount > 0) {
           //datapoints might have any combination of available symbols
           var ssymbol;
           if(cachedResponse.properties.timeseries[noonindex].data.hasOwnProperty('next_6_hours')) {
               ssymbol = cachedResponse.properties.timeseries[noonindex].data.next_6_hours.summary.symbol_code
           }
           else if(cachedResponse.properties.timeseries[noonindex].data.hasOwnProperty('next_12_hours')) {
               ssymbol = cachedResponse.properties.timeseries[noonindex].data.next_12_hours.summary.symbol_code
           }
           else if(cachedResponse.properties.timeseries[noonindex].data.hasOwnProperty('next_1_hours')) {
               ssymbol = cachedResponse.properties.timeseries[noonindex].data.next_1_hours.summary.symbol_code
           }
           else {
               ssymbol = "fair_day"; //give fair day if nothing else found!
           }
           
           weatherdata.push({
               air_pressure_at_sea_level:Math.round(sums.air_pressure_at_sea_level_sum/datacount),
               air_temperature:Math.round(sums.air_temperature_sum/datacount),
               cloud_area_fraction:Math.round(sums.cloud_area_fraction_sum/datacount),
               relative_humidity:Math.round(sums.relative_humidity_sum/datacount),
               wind_from_direction:Math.round(sums.wind_from_direction_sum/datacount),
               wind_speed:Math.round(((sums.wind_speed_sum/datacount) * 10)) / 10,
               symbol:ssymbol,
               temperature_min:Math.round(Math.min.apply(Math, daytemps)),
               temperature_max:Math.round(Math.max.apply(Math, daytemps))
           });
        }
        else {
           weatherdata.push(0);
        }
    }

    var device = plugin.Devices[1];
    var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    //update forecast values for next 7 days
    for(i=1; i < 8; i++) {
        device['temperature'+i]   = weatherdata[i].air_temperature;
        device['symbol'+i]        = weatherdata[i].symbol + ".png";
        device['weekday'+i]       = days[new Date(datestarts[i]).getDay()];
        device['tempmin'+i]       = weatherdata[i].temperature_min;
        device['tempmax'+i]       = weatherdata[i].temperature_max;
    }
    
    //update now values
    device.weekday_now =            days[m.getDay()];
    device.airpressure_now =        cachedResponse.properties.timeseries[nowindex].data.instant.details.air_pressure_at_sea_level;
    device.temperature_now =        cachedResponse.properties.timeseries[nowindex].data.instant.details.air_temperature;
    device.cloudareafraction_now =  cachedResponse.properties.timeseries[nowindex].data.instant.details.cloud_area_fraction;
    device.humidity_now =           cachedResponse.properties.timeseries[nowindex].data.instant.details.relative_humidity;
    device.winddirection_now =      cachedResponse.properties.timeseries[nowindex].data.instant.details.wind_from_direction;
    device.windspeed_now =          cachedResponse.properties.timeseries[nowindex].data.instant.details.wind_speed;

    if( (device.winddirection_now > 337.5) && (device.winddirection_now <= 22.5) ) {
        device.winddirection_now_arrow = "\u2191";
    }
    else if( (device.winddirection_now > 22.5) && (device.winddirection_now <= 67.5) ) {
        device.winddirection_now_arrow = "\u2197";
    }
    else if( (device.winddirection_now > 67.5) && (device.winddirection_now <= 112.5) ) {
        device.winddirection_now_arrow = "\u2192";
    }
    else if( (device.winddirection_now > 112.5) && (device.winddirection_now <= 157.5) ) {
        device.winddirection_now_arrow = "\u2198";
    }
    else if( (device.winddirection_now > 157.5) && (device.winddirection_now <= 202.5) ) {
        device.winddirection_now_arrow = "\u2193";
    }
    else if( (device.winddirection_now > 202.5) && (device.winddirection_now <= 247.5) ) {
        device.winddirection_now_arrow = "\u2199";
    }
    else if( (device.winddirection_now > 247.5) && (device.winddirection_now <= 292.5) ) {
        device.winddirection_now_arrow = "\u2190";
    }
    else {
        device.winddirection_now_arrow = "\u2196";
    }

    var ssymbol;
    if(cachedResponse.properties.timeseries[nowindex].data.hasOwnProperty('next_1_hours')) {
       ssymbol = cachedResponse.properties.timeseries[nowindex].data.next_1_hours.summary.symbol_code
    }
    else if(cachedResponse.properties.timeseries[nowindex].data.hasOwnProperty('next_6_hours')) {
       ssymbol = cachedResponse.properties.timeseries[nowindex].data.next_6_hours.summary.symbol_code
    }
    else if(cachedResponse.properties.timeseries[nowindex].data.hasOwnProperty('next_12_hours')) {
       ssymbol = cachedResponse.properties.timeseries[nowindex].data.next_12_hours.summary.symbol_code
    }
    else {
       ssymbol = "fair_day"; //give fair day if nothing else found!
    }
    device.symbol_now = ssymbol + ".png";
}

function onSynchronizeDevices() {
    var metno1 = new Device();
    metno1.Id = "1";
    metno1.DisplayName = "Metno 1";
    metno1.Capabilities = [];
    metno1.Attributes = [
    "temperature_now", "weekday_now", "symbol_now", "airpressure_now", "cloudareafraction_now", "humidity_now", "winddirection_now", "winddirection_now_arrow", "windspeed_now",
    "temperature1","temperature2","temperature3","temperature4","temperature5","temperature6","temperature7",
    "weekday1","weekday2","weekday3","weekday4","weekday5","weekday6","weekday7",
    "symbol1","symbol2","symbol3","symbol4","symbol5","symbol6","symbol7",
    "tempmin1","tempmin2","tempmin3","tempmin4","tempmin5","tempmin6","tempmin7",
    "tempmax1","tempmax2","tempmax3","tempmax4","tempmax5","tempmax6","tempmax7"
    ];
    
    plugin.Devices[metno1.Id] = metno1;
}
