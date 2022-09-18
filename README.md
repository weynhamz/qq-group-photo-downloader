QQ Group Photo Downloader
=========================


Download all raw album photos from a QQ Group.


## Usage

Requires [Yarn 2 PnP](https://yarnpkg.com/features/pnp).


1. Fetch all albums.

A browser will open, and please manually finish the authentication first, then it will start exectution.

```
yarn node prepare.js ID_OF_THE_QQ_GROUP

```

2. Download the photos.

Photos will be downloaded to the corresponding album folder.

```
yarn node download.js JSON_FILE_GENERATED_FROM_STEP_1
```

An alternative version, use Puppeteer to download the photos.

```
yarn node download-2.js JSON_FILE_GENERATED_FROM_STEP_1
```
