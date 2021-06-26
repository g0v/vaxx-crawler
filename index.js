curl 'https://antiflu.cdc.gov.tw/Covid19/GetHospitalData' -H 'x-requested-with: XMLHttpRequest' --data-raw 'bottom=22&left=100&right=130&top=27'
const locations_data = require('./locations.json');
const fs = require('fs');
const stringify = require('csv-stringify');

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


locations_data.forEach(element => {
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
    fs.writeFile('my.csv', output, (err) => {
        if (err) throw err;
        console.log('my.csv saved.');
    });
});