const fs = require('fs');
const path = require('path');

const dir = 'c:\\Projetos\\studio57so-v8\\OFX_COPIA_SEGURANCA';

function parseOfx(content) {
    const getTag = (tag) => {
        const match = content.match(new RegExp(`<${tag}>([^<\r\n]+)`, 'i'));
        return match ? match[1].trim() : null;
    };

    const bankId = getTag('BANKID') || getTag('ROUTINGNUM') || '000';
    const acctId = getTag('ACCTID') || '0000';

    const dtStart = getTag('DTSTART');
    const dtEnd = getTag('DTEND');
    const dtServer = getTag('DTSERVER');
    const dtPosted = getTag('DTPOSTED');

    let dateRaw = dtStart || dtEnd || dtServer || dtPosted;

    let year = '0000';
    let month = '00';
    if (dateRaw && dateRaw.length >= 6) {
        year = dateRaw.substring(0, 4);
        month = dateRaw.substring(4, 6);
    }

    return { bankId, acctId, year, month };
}

function walk(dir, done) {
    let results = [];
    fs.readdir(dir, function (err, list) {
        if (err) return done(err);
        let i = 0;
        function next() {
            let file = list[i++];
            if (!file) return done(null, results);
            file = path.resolve(dir, file);
            fs.stat(file, function (err, stat) {
                if (stat && stat.isDirectory()) {
                    walk(file, function (err, res) {
                        results = results.concat(res);
                        next();
                    });
                } else {
                    if (file.toLowerCase().endsWith('.ofx') || file.toLowerCase().endsWith('.ofc')) {
                        results.push(file);
                    }
                    next();
                }
            });
        }
        next();
    });
}

walk(dir, (err, files) => {
    if (err) throw err;
    let counts = {};
    for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        const { bankId, acctId, year, month } = parseOfx(content);

        let newName = `${year}_${month}_${bankId}_${acctId}`;
        const ext = path.extname(file);

        if (!counts[newName]) counts[newName] = 0;
        counts[newName]++;

        let finalName = newName + (counts[newName] > 1 ? `_${counts[newName]}` : '') + ext;
        let newPath = path.join(dir, finalName);

        fs.renameSync(file, newPath);
        console.log(`Renamed: ${path.relative(dir, file)} -> ${finalName}`);
    }
    console.log(`Renamed ${files.length} files successfully.`);
});
