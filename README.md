> wrt

# wrt: Hassle Free Writing

`wrt`, or Write, or With Regards To, helps you organize files for writing. Use
it to organize your journals and notes. It does not impose any structure on
these files. If you like to maintain notes in flat files, and spend a lot of
time navigating to the correct directories or abiding by your own naming
conventions, `wrt` could be for you.

`wrt` does absolutely nothing fancy. It could just as easily be a shell script
or system of shell aliases. For example, imagine this workflow. I have a
meeting today with Joe. It is for work, and I like to keep my work notes in
`~/Dropbox/notes`. Before each meeting I type `vim
~/Dropbox/notes/2017/2017-03-07_joe-meeting.md`. Then I take notes. This is
completely reasonable, but it's a lot of work to get up and running. Instead, I
can type `wrt notes joe meeting` and it will accomplish the exact same thing.

I organize my journal the same way as I do my notes. I write more journal
entries than notes, so my default notebook is `journal`. Since it is the
default, `wrt journal day one in peru` and `wrt day one in peru` do the same
thing. (Note that if you had a notebook called `day`, it might not do what you
expected.) If I'm just making a quick note and I don't want to give the file
name a title, the default title will be `daily`.


# Understanding wrt

`wrt` separates writing into different files for each day. A basic directory
structure for a journal might look like:

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
    case it is rooted at `journal/`, but you can have multiple notebooks on
    the same system. In this way `wrt journal` would open an entry for your
    personal journal, but `wrt notes` would open an entry for your notes files.


# Shoutouts

`wrt` is inspired by tools like [`jrnl`](http://jrnl.sh/) but does not try to
replace them. It does different things.

