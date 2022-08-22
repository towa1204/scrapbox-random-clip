import puppeteer from 'puppeteer';
import { Command } from 'commander';

const program = new Command();
program
  .requiredOption('-p, --project <projectname>', 'scrapbox projectname')
  .option('-c, --connectsid <value>', 'connect.sid value (used for private projects)')
  .parse(process.argv);

const options = program.opts();
console.log(`projectname: ${options.project}`);
console.log(`connect.sid: ${options.connectsid}`);

// (async () => {
//   const browser = await puppeteer.launch();
//   const page = await browser.newPage();
//   await page.goto('https://example.com');
//   await page.screenshot({ path: 'example.png' });

//   await browser.close();
// })();
