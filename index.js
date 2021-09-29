const puppeteer = require('puppeteer');
const fs = require('fs');

function flipCoordinate(whiteKingPosition) {
    const file = whiteKingPosition[0];
    const rank = whiteKingPosition[1];

    if (file === 'a') {
        return 'h' + (9 - rank);
    }
    if (file === 'b') {
        return 'g' + (9 - rank);
    }
    if (file === 'c') {
        return 'f' + (9 - rank);
    }
    if (file === 'd') {
        return 'e' + (9 - rank);
    }
    if (file === 'e') {
        return 'd' + (9 - rank);
    }
    if (file === 'f') {
        return 'c' + (9 - rank);
    }
    if (file === 'g') {
        return 'b' + (9 - rank);
    }
    if (file === 'h') {
        return 'a' + (9 - rank);
    } else {
        return `idk-${whiteKingPosition}`
    }
}

async function takeBoardScreenshot(page, gameUrl) {
    console.log('Loading game', gameUrl);
    await page.goto(gameUrl);

    // Disable coordinates
    await page.waitForSelector('.board-controls-icon');
    const controlsButton = await page.$('.board-controls-icon');
    controlsButton.evaluate(button => button.click());
    await page.waitForSelector('.board-settings-modal');
    await page.waitForTimeout(200);
    await page.click('#coordinate');
    await page.waitForTimeout(200);
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await (await page.$('.section-title-dismissible-icon')).evaluate(button => button.click());
    await page.waitForTimeout(300);

    // Flip board if username is Carlsen
    const usernameElements = await page.$$('.user-username-component');
    const firstUsernameElement = usernameElements[0];
    const firstUsername = await (await firstUsernameElement.getProperty('textContent')).jsonValue();

    let flipped = false;

    if (firstUsername === 'Magnus Carlsen') {
        console.log('Need to switch board!');
        await page.waitForSelector('.board-controls-flip');
        const flipBoardElement = await page.$('.board-controls-flip');
        await flipBoardElement.evaluate(button => button.click());
        flipped = true;
    }

    // Take screenshot of board
    await page.waitForSelector('#board-layout-chessboard');
    const boardElement = await page.$('#board-layout-chessboard');

    // Find all the white-king moves
    const whiteKingMoveElements = await page.$$('.king-white');
    const lastWhiteKingMove = whiteKingMoveElements.splice(-1)[0];

    // Determine last white king position
    let whiteKingPosition = 'e1';
    if (lastWhiteKingMove) {
        whiteKingPosition = (await lastWhiteKingMove.evaluate(elem => elem.nextSibling.textContent));
        whiteKingPosition = whiteKingPosition.replace('+', '');
        whiteKingPosition = whiteKingPosition.replace('x', '');
        whiteKingPosition = whiteKingPosition.replace('#', '');
    }
    if (flipped) {
        console.log('Flipped', whiteKingPosition, 'to', flipCoordinate(whiteKingPosition));
        whiteKingPosition = flipCoordinate(whiteKingPosition);
    }

    const directory = `games/${whiteKingPosition}`;
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory);
    }

    // Check if the error alert popped
    const alertClose = await page.$('.alert-banner-close');
    if (alertClose) {
        console.log('Closing alert popup');
        await alertClose.evaluate(button => button.click());
        await page.waitForTimeout(300);
    }

    const gameId = gameUrl.split('/').splice(-1)[0];
    const fileName = `${directory}/${gameId}.png`;
    await boardElement.screenshot({path: fileName});
    // await page.screenshot({path: fileName});

    console.log('Finished game', gameUrl);
}

async function readGameList(page, pageUrl) {
    await page.goto(pageUrl);
    await page.waitForSelector('.master-games-clickable-link');

    // Get list elements
    const linkElements = await page.$$('.master-games-master-game > td:first-of-type > a:first-of-type');
    return await Promise.all(linkElements.map((async elem => await (elem.evaluate(a => a.getAttribute('href'))))));
}

(async () => {
    const browser = await puppeteer.launch();
    const mainPage = await browser.newPage();
    await mainPage.setViewport({width: 1080, height: 1080});

    const baseUrl = 'https://www.chess.com/games/search?opening=&openingId=&p1=Magnus%20Carlsen&p2=&lstresult=0&mr=&lsty=1&year=&lstMoves=1&moves=&fen=&sort=8&page=';

    for (let i = 1; i <= 128; i++) {
        console.log('Doing page number', i);
        const games = await readGameList(mainPage, baseUrl + i);
        await Promise.all(games.map(async gameUrl => {
            const boardPage = await browser.newPage();
            await boardPage.setViewport({width: 1920, height: 1080});
            await takeBoardScreenshot(boardPage, gameUrl);
            await boardPage.close();
        }));
    }

    await browser.close();
})();
