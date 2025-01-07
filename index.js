const express = require('express');
const path = require('path');
const app = express();
const ejs = require('ejs');
const fs = require('fs');
const session = require('express-session');

var multer = require('multer');

app.use(session({
    secret: 'sample',
    resave: false,              
    saveUninitialized: true,    
    cookie: { secure: false }  
  }));

const mariadb = require('mariadb');
const connection = mariadb.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: 'system',
    database: 'myschool',
    port: '3306'
});


const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'upload/');
    },
    filename: (req, file, cb) => {
        file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8')
        cb(null, file.originalname);
    }
});

var upload = multer({ storage: storage });

var bodyParser = require('body-parser')
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(bodyParser.text());

app.set('view engine', 'ejs');


app.listen(8888);
app.use('/public', express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
    res.locals.session = req.session; 
    next();
  });

// 메인
app.get('/', async (req, res) => {
    let data = await dbQuery();
    // console.log(data);
    res.render('show', { data: data , session : req.session});
});

// 회원가입
app.get('/signup', (req, res) => {
    res.render('signup');
});

app.post('/signup.ps', (req, res) => {
    var data = req.body;
    // console.log(data);s
    insertUser(data.id, data.pw);
    res.send('<script>alert("회원가입이 완료되었어요: ' + data.id + '"); window.location.href="/login";</script>');
});

// 회원가입
app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login.ps', async (req, res) => {
    var data = req.body;
    // console.log(data);
    const user = await checkUser(data.id, data.pw);

    if (user) {
        req.session.userId   = data.id;
        req.session.loggedIn = true;
        res.render('show', {data : await dbQuery()})
        console.log('true');
    }
    else {
        res.redirect('/login');
        console.log('false');
    }
});
app.get('/upload', (req, res) => {
    if (!req.session.loggedIn) {
        res.send('<script>alert("로그인을 먼저 진행해주세요"); window.location.href="/login";</script>');
        return;
    }
    res.render('upload');
});


app.post('/upload.ps', upload.single('uploadFile'), (req, res) => {
    console.log(req.file);
    dbInsert(req.file.originalname.toString('utf8'), req.session.userId);
    res.redirect('/show');
});

app.get('/show', async (req, res) => {
    let data = await dbQuery();
    // console.log(data);
    res.render('show', { data: data });
});

app.get('/delete', async (req, res) => {
    let targetFile = await getFileById(req.query.id);
    targetFile = targetFile[0];
    console.log(req.session.userId + "  " + targetFile);
    if (req.session.userId === targetFile.uploader) {
        deleteFile(req.query.id);
        fs.rmSync(path.join(__dirname, 'upload', targetFile.filename), {
            force: true,
        });
    }
    res.redirect('/show');
});

app.get('/image', (req, res) => {
    const fileName = req.query.filename;
    const filePath = path.join(__dirname, 'upload', fileName);
    //console.log(filePath);
    res.sendFile(filePath);
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/show');
});


async function dbInsert(filename, uploader) {
    let conn;
    conn = await connection;

    const result = await conn.query(`INSERT INTO files (filename, uploader) VALUES (?, ?);`, [filename, uploader]);
    console.log(result);

}

async function dbQuery() {
    let conn;
    conn = await connection;

    const result = await conn.query(`SELECT filename,  upload_date,uploader, id from files;`);
    return result;
}

async function insertUser(id, pw) {
    let conn;
    conn = await connection;

    const result = await conn.query(`INSERT INTO users (id, pw) VALUES(?, ?)`, [id, pw]);
    console.log(result)
}

async function checkUser(id, pw) {
    let conn;
    conn = await connection;

    const result = await conn.query(`SELECT * FROM users WHERE id = ? AND pw = ?`, [id, pw]);

    return result.length > 0 ? result[0] : null;
}

async function deleteFile(id) {
    let conn;
    conn = await connection;

    await conn.query(`DELETE FROM files WHERE id = ?`, [id]);
    
}

async function getFileById(id) {
    let conn;
    conn = await connection;

    return await conn.query(`SELECT * FROM files WHERE id = ?`, [id]);
}