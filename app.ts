/* eslint-disable no-plusplus */
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
// console.log(`connect.sid: ${options.connectsid}`);

const fetchOpts =
  options.connectsid !== undefined
    ? {
        headers: {
          cookie: `connect.sid=${options.connectsid}`,
        },
      }
    : undefined;

const cookie = {
  name: 'connect.sid',
  value: options.connectsid,
  url: 'https://scrapbox.io/',
  domain: 'scrapbox.io',
};

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

const randomScreenshot = async (pageUrl: string) => {
  const browser = await puppeteer.launch({ args: ['--start-maximized'] });
  const page = await browser.newPage();
  if (options.connectsid !== undefined) await page.setCookie(cookie);
  await page.goto(pageUrl, { waitUntil: 'networkidle0' });

  // ページ行数を取得
  const lineSize = (await page.$$('div.lines div.line')).length;
  console.log(`ページの行数: ${lineSize}`);

  // TODO: ランダムにスクリーンショットの範囲を決定
  // document.querySelectorAll('div.lines div.line:nth-of-type(1)')[0].clientHeight
  // nth-of-type 1 <= x <= lineSize
  const linesRange = { startLine: 1, endLine: Math.floor(Math.random() * lineSize + 1) };
  console.log(`スクリーンショットの範囲: startLine: ${linesRange.startLine}, endLine: ${linesRange.endLine}`);

  // スクリーンショット範囲のElementを取得(要修正)
  await page.evaluate(({ startLine, endLine }) => {
    function wrapAll(nodes: NodeListOf<Element>, wrapper: HTMLDivElement) {
      const parent = nodes[0].parentNode;
      if (parent === null) throw new Error('parent is null');
      const { previousSibling } = nodes[0];
      for (let i = 0; nodes.length - i; wrapper.firstChild === nodes[0] && i++) {
        wrapper.appendChild(nodes[i]);
      }
      const nextSibling = previousSibling ? previousSibling.nextSibling : parent.firstChild;
      parent.insertBefore(wrapper, nextSibling);
      return wrapper;
    }
    const div = document.createElement('div');
    div.setAttribute('id', 'screenshotRange');
    const elements = document.querySelectorAll(
      `div.lines div.line:nth-of-type(n+${startLine}):nth-of-type(-n+${endLine})`
    );
    // スクリーンショット範囲をdiv#screenshotRangeでwrap
    wrapAll(elements, div);
    // 一定の画面サイズを超えるとnavBarがどういうわけか現れるので事前に削除
    const navElem = document.querySelector('nav.navbar.navbar-default');
    if (navElem !== null) navElem.remove();
  }, linesRange);

  const twRangeSize = await page.$$('div#screenshotRange');
  await twRangeSize[0].screenshot({ path: 'test.png' });
  await browser.close();
};

const main = async () => {
  const page = await getRandomPage(options.project);
  console.log(page);
  randomScreenshot(page.url);
};

main();
