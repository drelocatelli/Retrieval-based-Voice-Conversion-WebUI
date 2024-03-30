const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');
const http = require('http');
const { default: puppeteer } = require('puppeteer');

const app = express();
const server = http.createServer(app);

app.use(express.static('public'));
app.use('/weights', express.static(path.join(__dirname, '../weights')));

const wss = new WebSocket.Server({ server });
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, '../models/') // Diretório onde os arquivos serão salvos
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`) // Nome do arquivo será um timestamp seguido do nome original
  }
});
const upload = multer({ storage });

app.get('/train/:host', async (req, res) => {
  try {
    await train(req.params.host);
    
    return res.status(200).json();
  } catch(err) {
    return res.status(500).json(err);
  }

});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/files', (req, res) => {
  const directoryPath = path.join(__dirname, '../weights/');

  fs.readdir(directoryPath, (err, files) => {
      if (err) {
          console.error('Error reading directory:', err);
          res.status(500).json({ error: 'Internal Server Error' });
          return;
      }

      files = files.filter(file => file !== '.gitignore');

      files = files.map((file) => {
          return {
              name: file,
          }
          
      });

      return res.json(files);
  });
});

app.get('/download/:fileName', (req, res) => {
  const fileName = req.params.fileName;
  const filePath = path.join(__dirname, '../weights/', fileName);

  // Check if the file exists
  if (fs.existsSync(filePath)) {
      // Set the appropriate headers for the download
      res.setHeader('Content-disposition', `attachment; filename=${fileName}`);
      res.setHeader('Content-type', 'application/octet-stream');

      // Pipe the file stream to the response
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
  } else {
      res.status(404).send('File not found');
  }
});

app.get('/cleanFolder', (req, res) => {
  const folderPath = path.join(__dirname, '../models/');

  fs.readdir(folderPath, (err, files) => {
      if (err) {
          console.error('Error reading directory:', err);
          return;
      }
  
      files.forEach(file => {
          const filePath = path.join(folderPath, file);
          fs.unlinkSync(filePath); // or use fs.unlink for asynchronous operation
          console.log(`Deleted ${file}`);
      });
  });

  console.log('Folder clean')

  return res.status(200).json();
});

app.post('/upload', upload.single('file'), function(req, res) {
    // upload files
    if (req.file) {
      console.log('File uploaded:', req.file);
      res.sendStatus(200);
    } else {
      res.sendStatus(400);
    }
    
});

// watch pth files

app.get('/weightschange', (req, res) => {
  res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
  });

  // Watch for changes in the folder
  const folderPath = path.join(__dirname, '../weights/');
  fs.watch(folderPath, async (eventType, filename) => {
      console.log('File changed:', filename);
      // Send notification to clients
      fs.readdir(folderPath, (err, files) => {
        if (err) {
            console.error('Error reading directory:', err);
            return;
        }
        // Send files array to clients
        res.write(`data: ${JSON.stringify({ files })}\n\n`);
    });
  });

  // Handle client disconnect
  req.on('close', () => {
      console.log('Client disconnected');
  });
});

app.get('/onupload', (req, res) => {
  res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
  });

  // Watch for changes in the folder
  const folderPath = path.join(__dirname, '../models/');
  fs.watch(folderPath, async (eventType, filename) => {
      console.log('File changed:', filename);
      // Send notification to clients
      fs.readdir(folderPath, (err, files) => {
        if (err) {
            console.error('Error reading directory:', err);
            return;
        }
        // Send files array to clients
        res.write(`data: ${JSON.stringify({ files })}\n\n`);
    });
  });

  // Handle client disconnect
  req.on('close', () => {
      console.log('Client disconnected');
  });
});


async function train(host) {
  // get file name
  let filename;
  fs.readdir(path.join(__dirname, '../models/'), (err, files) => {
    if (err) {
      console.error('Error reading folder:', err);
      return;
    }
  
    // Get the first file name
    filename = files[0];
    filename =  encodeURIComponent(path.parse(filename).name);
  });
  
  const browser = await puppeteer.launch({
    headless: false,
    // devtools: true,
    dumpio: true,
    defaultViewport: null,
    args: ['--start-maximized'] 

  });

  const pages = await browser.pages();
  const page = pages[0];
  await page.goto(`http://localhost:7897`);
  await page.waitForSelector('gradio-app');

   // Get screen size
   const screenSize = await page.evaluate(() => {
    return {
      width: window.screen.width,
      height: window.screen.height
    };
  });

  // Calculate the coordinates based on the screen size
  const x = (value) => Math.round((value / 1920) * screenSize.width);
  const y = (value) => Math.round((value / 1080) * screenSize.height);

  // Perform mouse click
  await page.mouse.click(x(783.234375), y(112), { button: 'left' });

  // change name of weight
  await page.mouse.click(x(222.5), y(271), { button: 'left' });
  await page.keyboard.down('Control');
  await page.keyboard.press('A');
  await page.keyboard.up('Control');
  await page.keyboard.type(filename);
  
  // change version
  await page.mouse.click(x(1196.78125), y(280), { button: 'left' });

  // change folder of models
  await page.mouse.click(x(222.5), y(454), { button: 'left' });
  await page.keyboard.down('Control');
  await page.keyboard.press('A');
  await page.keyboard.up('Control');
  await page.keyboard.type('D:\\RVC-BETA0717\\models');

  // change epoch to 69
  await page.mouse.click(x(469.671875 + 20), y(857), { button: 'left' });
  await page.keyboard.type('69');
}


app.listen(3000, function() {
  console.log('Server listening on port http://localhost:3000');
});