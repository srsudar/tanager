> Manage your notebooks. Start writing quickly.

[![Build Status](https://travis-ci.org/srsudar/tanager.svg?branch=master)](https://travis-ci.org/srsudar/tanager)

<p align="center">
  <img alt="Icon" src="./assets/icon-512.png" width="256"/>
</p>

# tanager: Hassle Free Writing

`tanager` is a notebook manager. It helps you organize files for writing. Use
it to organize your journals and notes. It does not impose any structure on
these files, but it is opinionated about where the files are stored and how
they are named.

If you like to maintain notes in flat files and spend a lot of time navigating
to the correct directories or abiding by your own naming conventions, `tanager`
could be for you.


# Overview

`tanager` does absolutely nothing fancy. It could just as easily be a shell
script or system of shell aliases. For example, imagine this workflow. I have a
meeting today with Joe. It is for work, and I like to keep my work notes in
`~/Dropbox/notes`. Before each meeting I type `vim
~/Dropbox/notes/2017/2017-03-07_joe-meeting.md`. Then I take notes. This is
completely reasonable, but it's a lot of work to get up and running. Instead, I
can type `tanager notes joe meeting` and it will accomplish the exact same
thing.

I organize my journal the same way as I do my notes. I write more journal
entries than notes, so my default notebook is `journal`. Since it is the
default, `tanager journal day one in peru` and `tanager day one in peru` do the
same thing. (Note that if you had a notebook called `day`, it might not do what
you wanted, instead adding an entry to the notebook called `day`.) If I'm just
making a quick note and I don't want to give the file name a title, the default
title will be `daily`.


# Installation

Keep in mind that however you install it, you'll have to set up a config file
before it will work. Eventually I might add a smart setup option, but for now
you have to do this by hand. See the [Configuration](#configuration) section
below.

You can run `tanager` from your local repo by cloning and typing `npm install
-g` from the local directory. Alternatively, you can use `npm`:

```
npm install -g tanager
```

To run tests:

```
npm test
```


# Usage

## Overview

`tanager` helps you start writing quickly. See the [understanding
tanager](#understanding-tanager) section to see where it puts your files. To
start writing notes in your `notes` notebook:

```
tanager notes meeting with vip
```

If the day is March 9, 2017, this will open your editor with a file called:
`2017-03-09_meeting-with-vip.md`. You can then begin editing.

If you also have a notebook called `journal`, you can instead type:

```shell
tanager journal day one in peru
```

This will open a file named `2017-03-09_day-one-in-peru.md`, but will be in
your `journal` notebook (i.e. saved in a different directory).


## Specifying a Date Other Than Today

You can also specify a different date using the `-d` flag. This does its best
to do natural language parsing as provided by the
[`chrono`](https://github.com/wanasit/chrono) library. To start a journal entry
for yesterday, you can say:

```shell
tanager -d yesterday leaving for lichtenstein
```

This will interpret `yesterday` to be the date, so instead it will open your
editor to `2017-03-08_leaving-for-lichtenstein.md`.


## Editing Last Modified File

The `-r`/`--recent` flag will begin editing the most recently modified file in
a given notebook, allowing you to repeatedly update an entry over the course of
a day or jump back in after a restart.

## Full Output of `tanager --help`

```
  Usage: tanager [options] <words...>

  Options:

    -h, --help                       output usage information
    -V, --version                    output the version number
    -c, --config-file <config-file>  Path to config file. Defaults to
                                       ~/.tanager.json
    -d, --date <date>                Date of the entry. Yesterday, dec5,
                                       "dec 5", etc
    -e, --editor-cmd <editor-cmd>    Editor used to edit. Defaults to
                                       config.editor, $VISUAL, then $EDITOR
    -r, --recent                     Edit the most recently modified file in
                                       a notebook
```


# Understanding tanager

`tanager` separates writing into different files for each day. A basic
directory structure for a journal might look like:

```
journal/
  2016/
    2016-03-05_day-in-london.md
    2016-03-06_daily.md
  2017/
    2017-01-01_new-year-party.md
    2017-01-01_daily.md
```

Some things to notice:

* Files are organized by year.
* Files are prefixed by date.
* Files are saved as markdown.
* Files can be given a title. If no title is given, it is given the default
    title `daily`.
* Document trees, or 'notebooks' can be rooted at different locations. In this
    case it is rooted at `journal/`, but you can have multiple notebooks on the
    same system. In this way `tanager journal` would open an entry for your
    personal journal, but `tanager notes` would open an entry for your notes
    files.


# Configuration

Config information lives in `~/.tanager.json`. It should have at a minimum a
`notebooks` object, where each key is a notebook name and points to an object
that includes a `path` property. A key `default: true` indicates that this is
the notebook that should be used if no name is specified.

For now the quickest way to understand it is with an example:

```json
{
  "notebooks": {
    "journal": {
      "path": "~/Dropbox/journal/",
      "aliases": ["j", "jl"],
      "default": true
    },
    "notes": {
      "path": "~/Documents/notes"
    }
  }
}
```


# Shout-outs

`tanager` is inspired by tools like [`jrnl`](http://jrnl.sh/) but does not try
to replace them. They does different things. If you set your `jrnl` file to
reside in the root directory of a `tanager` notebook, you could even get the
best of both worlds--keeping `jrnl` for your short entries, if you like that
kind of thing, but using `tanager` to manage longer entries.

If `tanager` doesn't meet your needs, here is a list of other tools that do
similar things:

* [jrnl](http://jrnl.sh/)
* [Falcon](http://falcon.star-lord.me/)
* [Inkdrop](https://www.inkdrop.info/)
* [Boostnote](https://boostnote.io/)
* [SoyWiki](http://danielchoi.com/software/soywiki.html)
* [Quiver](http://happenapps.com/#quiver)
