> Manage your notebooks. Start writing quickly.

[![Build Status](https://travis-ci.org/srsudar/tanager.svg?branch=master)](https://travis-ci.org/srsudar/tanager)

# tanager: Hassle Free Writing

`tanager` is a notebook manager. It helps you organize files for writing. Use
it to organize your journals and notes. It does not impose any structure on
these files, but it is opinionated about where the files are stored and how
they are named

If you like to maintain notes in flat files, and spend a lot of time navigating
to the correct directories or abiding by your own naming conventions, `tanager`
could be for you.

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

