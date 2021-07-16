// curl 'https://antiflu.cdc.gov.tw/Covid19/GetHospitalData' -H 'x-requested-with: XMLHttpRequest' --data-raw 'bottom=22&left=100&right=130&top=27' -o locations.json
const fs = require('fs');
const stringify = require('csv-stringify');
const exec = require('child_process').exec;
const config = require('./config.json');
const Airtable = require('airtable');
const sha256 = require('js-sha256').sha256;

function parse_short_url(_url) {
    return new Promise((resolve, reject) => {
        if (_url.includes("reurl.cc")) {
            let command = `curl -i  '${_url}' -q | grep Target`;
            child = exec(command, function (error, stdout, stderr) {
                if (stdout.split("Target: ").length > 1) {
                    resolve(stdout.split("Target: ")[1]);
                }
            });
        }
        else if (_url.includes("bit.ly")) {
            let command = `curl '${_url}' -i | grep -i location`;
            child = exec(command, function (error, stdout, stderr) {
                if (stdout.split("location: ").length > 1) {
                    resolve(stdout.split("location: ")[1]);
                }
            });
        }
        else {
            resolve(_url);
        }
    });
}

function data_parser(data) {
    return new Promise(async (resolve, reject) => {
        let export_data = [];
        let columns = {
            "醫事機構代碼（自動）": "醫事機構代碼（自動）",
            "施打站全稱（自動）": "施打站全稱（自動）",
            "施打站縣市（自動）": "施打站縣市（自動）",
            "施打站行政區（自動）": "施打站行政區（自動）",
            "施打站地址（自動）": "施打站地址（自動）",
            "施打站經度（自動）": "施打站經度（自動）",
            "施打站緯度（自動）": "施打站緯度（自動）",
            "官方提供網址（自動）": "官方提供網址（自動）",
            "預約電話（自動）": "預約電話（自動）"
        }
        await Promise.all(data.map(async (element) => {
            if (element['HospitalId'].length < 10) {
                element['HospitalId'] = "0" + element['HospitalId'];
            }
            let export_template = {
                "醫事機構代碼（自動）": element['HospitalId'],
                "施打站全稱（自動）": element['HospitalName'],
                "施打站縣市（自動）": element['City'],
                "施打站行政區（自動）": element['Dist'],
                "施打站地址（自動）": element['Address'],
                "預約電話（自動）": element['Phone'],
                "施打站經度（自動）": element['Long'],
                "施打站緯度（自動）": element['Lat'],
                "官方提供網址（自動）": null
            };
            var re = new RegExp('<a href=\'([^\']+)\'[^>]+>預約網址');
            let match = null;
            if ((match = re.exec(element['InfoWindowMessage'])) !== null) {
                let _url = await parse_short_url(match[1]);
                export_template["官方提供網址（自動）"] = _url;
            }
            else {
                re = new RegExp('<a href=\'([^\']+)\'[^>]+>院所明細');
                if ((match = re.exec(element['InfoWindowMessage'])) !== null) {
                    let _url = await parse_short_url(match[1]);
                    export_template["官方提供網址（自動）"] = _url;
                }
            }
            export_data.push(export_template);
        }));

        stringify(export_data, { header: true, columns: columns }, (err, output) => {
            if (err) throw err;
            fs.writeFile('out.csv', output, (err) => {
                if (err) throw err;
                console.log('out.csv saved.');
            });
        });

        let cb_data = {};
        export_data.forEach(function (data) {
            let _key = sha256(data['施打站縣市（自動）']+data['施打站全稱（自動）']);
            cb_data[_key] = data;
        });
        resolve(cb_data);
    });
};

let locations_data = require("./locations.json");

let update_data = [];
let create_data = [];

let base = new Airtable({ apiKey: config['API_KEY'] }).base('appwPM9XFr1SSNjy4');
function fetch_online() {
    let online_data = {};
    return new Promise((resolve, reject) => {
        base('施打點清單').select({
            maxRecords: 9999,
            view: "raw data"
        }).eachPage(function page(records, fetchNextPage) {
            records.forEach(function (record) {
                console.log('Retrieved', record.get('醫事機構代碼（自動）'));
                let _key = sha256(record.get('施打站縣市（自動）')+record.get('施打站全稱（自動）'));
                online_data[_key] = record;
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

    console.log("update data: ", update_data.length);
    console.log("create data: ", create_data.length);
    
    let chunk = 10;
    for (let i = 0; i < create_data.length; i += chunk) { // slice length into 10 for free airtable usage
        let tempArray;
        tempArray = create_data.slice(i, i + chunk);
        base('施打點清單').create(tempArray, function (err, records) {
            if (err) {
                console.error(err);
                return;
            }
            records.forEach(function (record) {
                console.log("create", record.getId());
            });
        });
    }

    for (let i = 0; i < update_data.length; i += chunk) { // slice length into 10 for free airtable usage
        let tempArray;
        tempArray = update_data.slice(i, i + chunk);
        base('施打點清單').update(tempArray, function (err, records) {
            if (err) {
                console.error(err);
                return;
            }
            records.forEach(function (record) {
                console.log("update", record.getId());
            });
        });
    }
    
})();