/* eslint-disable no-await-in-loop */
/* eslint-disable no-unused-expressions */
/* eslint-disable no-plusplus */
import puppeteer from 'puppeteer';
import fetch, { RequestInfo, RequestInit } from 'node-fetch';
import { Command } from 'commander';

function errorexit(message: string) {
  console.error(message);
  return process.exit(1);
}

const program = new Command();
program
  .name('npx ts-node app.ts')
  .requiredOption('-p, --project <projectname>', 'scrapbox projectname')
  .option('-c, --connectsid <value>', 'connect.sid value (used for private projects)')
  .option(
    '-s --size <imagesize>',
    'screenshot image size(px)',
    (value: string) => {
      const parsedValue = parseInt(value, 10);
      if (Number.isNaN(parsedValue) || parsedValue < 1) {
        errorexit('-s options value is invalid');
      }
      return parsedValue;
    },
    560
  )
  .parse(process.argv);

const options = program.opts();

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

// fetchのラッパー関数
async function fetchScrapboxApi(url: RequestInfo, init?: RequestInit) {
  const response = await fetch(url, init);
  const data = await response.json();
  if (!response.ok) return errorexit(`projectname: ${options.project}\n${data.name}: ${data.message}`);
  return data;
}

// 与えられた行番号の高さを返す
const calcLineHeight = async (page: puppeteer.Page, lineNum: number) => {
  const lineElem = await page.$(`div.lines div.line:nth-of-type(${lineNum})`);
  if (lineElem === null) return errorexit(`faild to get $(div.lines div.line:nth-of-type(${lineNum}))`);
  const lineHeight = await (await lineElem.getProperty('clientHeight')).jsonValue();
  return lineHeight;
};

// ランダムにMINHEIGHTpx以上のスクリーンショット範囲を取得
// もし、ページ全体のサイズがMINHEIGHTpx未満のとき、ページ全体の範囲を返す
const getScreenshotRange = async (page: puppeteer.Page, lineSize: number, MINHEIGHT: number) => {
  let imageHeight = 0;
  let lowerBound = lineSize;
  while (imageHeight < MINHEIGHT && lowerBound !== 0) {
    imageHeight += await calcLineHeight(page, lowerBound);
    lowerBound--;
  }

  let screenshotRange = { startLine: 0, endLine: 0 };
  if (lowerBound === 0 || imageHeight === MINHEIGHT) {
    screenshotRange = { startLine: lowerBound + 1, endLine: lineSize };
  } else {
    // 1 <= startLine <= lowerBound + 1
    screenshotRange.startLine = Math.floor(Math.random() * (lowerBound + 1)) + 1;
    screenshotRange.endLine = screenshotRange.startLine;
    imageHeight = 0;
    while (imageHeight < MINHEIGHT) {
      imageHeight += await calcLineHeight(page, screenshotRange.endLine);
      screenshotRange.endLine++;
    }
    screenshotRange.endLine--; // imageHeightはstartLine~endLined-1の範囲になる
  }
  return screenshotRange;
};

// Scrapboxのプロジェクトの中からランダムにページを選択、そのページのタイトルとページURLを取得
const getRandomPage = async (projectname: string) => {
  const pageSize: number = (await fetchScrapboxApi(`https://scrapbox.io/api/pages/${projectname}?limit=1`, fetchOpts))
    .count; // プロジェクトの総ページ数
  const randNum = Math.floor(Math.random() * pageSize); // 0 <= randNum < pageSize

  const pageTitle: string = (
    await fetchScrapboxApi(`https://scrapbox.io/api/pages/${projectname}?limit=1&skip=${randNum}`, fetchOpts)
  ).pages[0].title;

  const lineSize: number = (await fetchScrapboxApi(`https://scrapbox.io/api/pages/${projectname}/${pageTitle}`)).lines
    .length;

  return {
    title: pageTitle,
    url: `https://scrapbox.io/${projectname}/${encodeURIComponent(pageTitle)}`,
    size: lineSize,
  };
};

const randomScreenshot = async ({ title, url }: { title: string; url: string }) => {
  const browser = await puppeteer.launch({ args: ['--start-maximized'] });
  const page = await browser.newPage();
  if (options.connectsid !== undefined) await page.setCookie(cookie);
  await page.goto(url, { waitUntil: 'networkidle0' });

  // ページ行数を取得
  const lineSize = (await page.$$('div.lines div.line')).length;
  // console.log(`ページの行数: ${lineSize}`);

  // ランダムにスクリーンショットの範囲を決定
  const linesRange = await getScreenshotRange(page, lineSize, options.size);
  // console.log(`スクリーンショットの範囲: startLine: ${linesRange.startLine}, endLine: ${linesRange.endLine}`);

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

  const screenshotRangeElem = await page.$('div#screenshotRange');
  const filename = `${new Date().toLocaleString('sv').replace(/\D/g, '')}.png`; // YYYYMMDDHHmmss.png
  if (screenshotRangeElem === null) return errorexit('failed to get div#screenshotRange');
  await screenshotRangeElem.screenshot({ path: filename });
  await browser.close();
  console.log(`${title}\n${url}\n${filename}`);
};

const main = async () => {
  const page = await getRandomPage(options.project);
  randomScreenshot(page);
};

main();
