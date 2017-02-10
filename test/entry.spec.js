'use strict'

const assert = require('assert')
const async = require('asyncawait/async')
const await = require('asyncawait/await')
const rmrf = require('rimraf')
const IpfsNodeDaemon = require('ipfs-daemon/src/ipfs-node-daemon')
const IpfsNativeDaemon = require('ipfs-daemon/src/ipfs-native-daemon')
const Entry = require('../src/entry')

const dataDir = './ipfs'

let ipfs, ipfsDaemon

[IpfsNodeDaemon].forEach((IpfsDaemon) => {
// [IpfsNodeDaemon, IpfsNativeDaemon].forEach((IpfsDaemon) => {

  describe('Entry', function() {
    this.timeout(60000)

    before((done) => {
      rmrf.sync(dataDir)
      ipfs = new IpfsDaemon({ IpfsDataDir: dataDir })
      ipfs.on('error', done)
      ipfs.on('ready', () => done())
    })

    after(() => {
      ipfs.stop()
      rmrf.sync(dataDir)
    })

    describe('create', () => {
      it('creates a an empty entry', async(() => {
        const expectedHash = 'QmV6eNeSZLnJDQcGou6HEiPQxipEgVam3B3onFSNmgpD4i'
        const entry = await(Entry.create(ipfs))
        assert.equal(entry.hash, expectedHash)
        assert.equal(entry.payload, null)
        assert.equal(entry.next.length, 0)
      }))

      it('creates a entry with payload', async(() => {
        const expectedHash = 'QmTVyxLqh3qZkWZbpxkjX5hd4WXADWDxt2EamFApfYpsRv'
        const payload = 'hello world'
        const entry = await(Entry.create(ipfs, payload))
        assert.equal(entry.payload, payload)
        assert.equal(entry.next.length, 0)
        assert.equal(entry.hash, expectedHash)
      }))

      it('creates a entry with payload and next', async(() => {
        const expectedHash = 'QmRzyeUuW5F8zxmEgJG3wRPH3i3W7iwPweza7UUHhXfK93'
        const payload1 = 'hello world'
        const payload2 = 'hello again'
        const entry1 = await(Entry.create(ipfs, payload1))
        const entry2 = await(Entry.create(ipfs, payload2, [entry1]))
        assert.equal(entry2.payload, payload2)
        assert.equal(entry2.next.length, 1)
        assert.equal(entry2.hash, expectedHash)
      }))

      it('`next` parameter can be an array of strings', async(() => {
        const entry1 = await(Entry.create(ipfs, null))
        const entry2 = await(Entry.create(ipfs, null, [entry1.hash]))
        assert.equal(typeof entry2.next[0] === 'string', true)
      }))

      it('`next` parameter can be an array of Entry instances', async(() => {
        const entry1 = await(Entry.create(ipfs, null))
        const entry2 = await(Entry.create(ipfs, null, [entry1]))
        assert.equal(typeof entry2.next[0] === 'string', true)
      }))

      it('`next` parameter can contain nulls and undefined objects', async(() => {
        const entry1 = await(Entry.create(ipfs, null))
        const entry2 = await(Entry.create(ipfs, null, [entry1, null, undefined]))
        assert.equal(typeof entry2.next[0] === 'string', true)
      }))

      it('throws an error if ipfs is not defined', async(() => {
        try {
          const entry = await(Entry.create())
        } catch(e) {
          assert.equal(e.message, 'Ipfs instance not defined')
        }
      }))

      it('throws an error if id is not defined', async(() => {
        try {
          const entry = await(Entry.create(ipfs))
        } catch(e) {
          assert.equal(e.message, 'Entry requires an id')
        }
      }))

      it('throws an error if data is not defined', async(() => {
        try {
          const entry = await(Entry.create(ipfs))
        } catch(e) {
          assert.equal(e.message, 'Entry requires data')
        }
      }))
    })

    describe('toMultihash', () => {
      it('returns an ipfs hash', async(() => {
        const expectedHash = 'QmVb4xt7ckFFyH3qxGtR4SKo3FcBD5itfPmyTqAjrAzcW3'
        const entry = await(Entry.create(ipfs))
        const hash = await(Entry.toMultihash(ipfs, entry))
        assert.equal(hash, expectedHash)
      }))
    })

    describe('fromMultihash', () => {
      it('creates a entry from ipfs hash', async(() => {
        const expectedHash = 'QmRzyeUuW5F8zxmEgJG3wRPH3i3W7iwPweza7UUHhXfK93'
        const payload1 = 'hello world'
        const payload2 = 'hello again'
        const entry1 = await(Entry.create(ipfs, payload1))
        const entry2 = await(Entry.create(ipfs, payload2, [entry1]))
        const final = await(Entry.fromMultihash(ipfs, entry2.hash))
        assert.equal(final.payload, payload2)
        assert.equal(final.next.length, 1)
        assert.equal(final.next[0], entry1.hash)
        assert.equal(final.hash, expectedHash)
      }))

      it('throws an error if ipfs is not present', async(() => {
        try {
          const entry = await(Entry.fromMultihash())
        } catch(e) {
          assert.equal(e.message, 'Ipfs instance not defined')
        }
      }))

      it('throws an error if hash is undefined', async(() => {
        try {
          const entry = await(Entry.fromMultihash(ipfs))
        } catch(e) {
          assert.equal(e.message, 'Invalid hash: undefined')
        }
      }))
    })

    describe('hasChild', () => {
      it('returns true if entry has a child', async(() => {
        const payload1 = 'hello world'
        const payload2 = 'hello again'
        const entry1 = await(Entry.create(ipfs, payload1))
        const entry2 = await(Entry.create(ipfs, payload2, [entry1]))
        assert.equal(Entry.hasChild(entry2, entry1), true)
      }))

      it('returns false if entry does not have a child', async(() => {
        const payload1 = 'hello world'
        const payload2 = 'hello again'
        const entry1 = await(Entry.create(ipfs, payload1))
        const entry2 = await(Entry.create(ipfs, payload2))
        const entry3 = await(Entry.create(ipfs, payload2, [entry2]))
        assert.equal(Entry.hasChild(entry2, entry1), false)
        assert.equal(Entry.hasChild(entry3, entry1), false)
        assert.equal(Entry.hasChild(entry3, entry2), true)
      }))
    })

    describe('compare', () => {
      it('returns true if entries are the same', async(() => {
        const payload1 = 'hello world'
        const entry1 = await(Entry.create(ipfs, payload1))
        const entry2 = await(Entry.create(ipfs, payload1))
        assert.equal(Entry.isEqual(entry1, entry2), true)
      }))

      it('returns true if entries are not the same', async(() => {
        const payload1 = 'hello world1'
        const payload2 = 'hello world2'
        const entry1 = await(Entry.create(ipfs, payload1))
        const entry2 = await(Entry.create(ipfs, payload2))
        assert.equal(Entry.isEqual(entry1, entry2), false)
      }))
    })
  })
})
