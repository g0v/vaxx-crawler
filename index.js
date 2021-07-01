// curl 'https://antiflu.cdc.gov.tw/Covid19/GetHospitalData' -H 'x-requested-with: XMLHttpRequest' --data-raw 'bottom=22&left=100&right=130&top=27' -o locations.json
const fs = require('fs');
const fetch = require('node-fetch');
const stringify = require('csv-stringify');
const config = require('./config.json');
const Airtable = require('airtable');

function data_parser(data) {
    return new Promise((resolve, reject) => {
        let export_data = [];
        let columns = {
            "施打站代碼": "施打站代碼",
            "施打站簡稱": "施打站簡稱",
            "施打站全稱": "施打站全稱",
            "施打站縣市": "施打站縣市",
            "施打站行政區": "施打站行政區",
            "施打站地址": "施打站地址",
            "施打站經度": "施打站經度",
            "施打站緯度": "施打站緯度",
            "時段": "時段",
            "剩餘名額": "剩餘名額",
            "預約網址": "預約網址",
            "預約電話": "預約電話",
            "爬蟲程式碼位置": "爬蟲程式碼位置",
            "資料抓取時間": "資料抓取時間",
            "疫苗代碼": "疫苗代碼"
        }
        data.forEach(element => {
            let export_template = {
                "施打站代碼": element['HospitalId'],
                "施打站全稱": element['HospitalName'],
                "施打站縣市": element['City'],
                "施打站行政區": element['Dist'],
                "施打站地址": element['Address'],
                "預約電話": element['Phone'],
                "施打站經度": element['Long'],
                "施打站緯度": element['Lat'],
                "預約網址": null
            };
            var re = new RegExp('<a href=\'([^\']+)\'[^>]+>預約網址');
            let match = null;
            if ((match = re.exec(element['InfoWindowMessage'])) !== null) {
                export_template["預約網址"] = match[1];
            };
            export_data.push(export_template);
        });

        stringify(export_data, { header: true, columns: columns }, (err, output) => {
            if (err) throw err;
            fs.writeFile('out.csv', output, (err) => {
                if (err) throw err;
                console.log('out.csv saved.');
            });
        });

        let cb_data = {};
        export_data.forEach(function(data) {
            cb_data[data['施打站代碼']] = data;
        });
        resolve(cb_data);
    });
};

let locations_data = require("./out.json");

let update_data = [];
let create_data = [];

let base = new Airtable({ apiKey: config['API_KEY'] }).base('appwPM9XFr1SSNjy4');
function fetch_online() {
    let online_data = {};
    return new Promise((resolve, reject) => {
        base('施打站清單').select({
            view: "raw data"
        }).eachPage(function page(records, fetchNextPage) {
            records.forEach(function (record) {
                console.log('Retrieved', record.get('施打站代碼'));
                online_data[record.get('施打站代碼')] = record;
            });
            fetchNextPage();
        }, function done(err) {
            if (err) { console.error(err); return; }
            resolve(online_data);
        });
    });
};

(async function main() {
    let new_data = await data_parser(locations_data);
    let online_data = await fetch_online();
    Object.keys(new_data).forEach(function (id) {
        if (id in online_data) {
            //console.log("update",id);
            update_data.push({
                "id": online_data[id]['id'],
                "fields": new_data[id]
            })
        }
        else {
            //console.log("create",id);
            create_data.push({
                "fields": new_data[id]
            })
        }
    });
    
    let chunk = 10;
    for (let i=0; i < create_data.length; i += chunk) { // slice length into 10 for free airtable usage
        let tempArray;
        tempArray = create_data.slice(i, i + chunk);
        base('施打站清單').create(tempArray, function (err, records) {
            if (err) {
                console.error(err);
                return;
            }
            records.forEach(function (record) {
                console.log("create",record.getId());
            });
        });
    }

    for (let i=0; i < update_data.length; i += chunk) { // slice length into 10 for free airtable usage
        let tempArray;
        tempArray = update_data.slice(i, i + chunk);
        base('施打站清單').update(tempArray, function (err, records) {
            if (err) {
                console.error(err);
                return;
            }
            records.forEach(function (record) {
                console.log("update",record.getId());
            });
        });
    }

})();