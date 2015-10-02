# buenos-stats

A command line utility for your NPM package stats

## Description

Provides you with daily, weekly, and monthly download counts, and the number of dependents on your package.

Specify one or more specific packages, or a user to get all package stats for packages by that user.

## Installation

Preferably global

```bash
$ npm install -g buenos-stats
```

## Usage

```bash
$ buenos-stats [package] [package] [arguments]
```

Where `package` is a package name.

### Arguments

- `--?`: view manual
- `--user=<user>`: specify a user (may be comma separated)
- `--store`: store query (can only store one per install), needs at least one package or user
- `--unstore`: remove stored query

### Examples

Get stats for npm and express:

```bash
$ buenos-stats npm express
```

Get stats for npm and user buenos:

```bash
buenos-stats npm --user=buenos
```
