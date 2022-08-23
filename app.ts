import puppeteer from 'puppeteer';
import fetch from 'node-fetch';
import { Command } from 'commander';

const program = new Command();
program
  .requiredOption('-p, --project <projectname>', 'scrapbox projectname')
  .option('-c, --connectsid <value>', 'connect.sid value (used for private projects)')
  .parse(process.argv);

const options = program.opts();
console.log(`projectname: ${options.project}`);
console.log(`connect.sid: ${options.connectsid}`);

const fetchOpts =
  options.connectsid !== undefined
    ? {
        headers: {
          cookie: `connect.sid=${options.connectsid}`,
        },
      }
    : undefined;

const getRandomPage = async (projectname: string) => {
  // TODO: fetch のエラー処理
  const pageSize: number = (
    await (await fetch(`https://scrapbox.io/api/pages/${projectname}?limit=1`, fetchOpts)).json()
  ).count; // プロジェクトの総ページ数
  const randNum = Math.floor(Math.random() * pageSize); // 0 <= randNum < pageSize
  const randPageTitle: string = (
    await (await fetch(`https://scrapbox.io/api/pages/${projectname}?limit=1&skip=${randNum}`, fetchOpts)).json()
  ).pages[0].title;

  return { title: randPageTitle, url: `https://scrapbox.io/${projectname}/${encodeURIComponent(randPageTitle)}` };
};
const main = async () => {
  const pageLink = await getRandomPage(options.project);
  console.log(pageLink);
};

main();

// (async () => {
//   const browser = await puppeteer.launch();
//   const page = await browser.newPage();
//   await page.goto('https://example.com');
//   await page.screenshot({ path: 'example.png' });

//   await browser.close();
// })();
