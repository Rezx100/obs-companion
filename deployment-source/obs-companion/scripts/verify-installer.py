"""Verify NSIS payload structure, full raw-deflate integrity, and packaged ASAR/helper bytes.
This does not execute Windows code or constitute a native installation test.
"""
import hashlib, json, pathlib, struct, zlib
base = pathlib.Path(__file__).resolve().parent.parent
installer = base / 'dist/OBS-Companion-0.1.0-Setup.exe'
data = installer.read_bytes()
assert data[:2] == b'MZ'
pe = struct.unpack_from('<I', data, 0x3c)[0]
assert data[pe:pe+4] == b'PE\0\0'
header = data.find(bytes.fromhex('efbeadde') + b'NullsoftInst') - 4
assert header > 0
header_size, total_following = struct.unpack_from('<II', data, header+20)
assert len(data) == header + total_following
payload = zlib.decompress(data[header+28:-4], -15)
assert struct.unpack_from('<I', payload, 0)[0] == header_size
stored_crc = struct.unpack_from('<I', data, len(data)-4)[0]
crc_start = next((start for start in (0, 512, header) if zlib.crc32(data[start:-4]) == stored_crc), None)
assert crc_start is not None, 'NSIS CRC32 mismatch'
checks = []
for relative in ('resources/app.asar', 'resources/browsers/ffmpeg-1011/ffmpeg-win64.exe'):
    content = (base/'dist/win-unpacked'/relative).read_bytes()
    assert content in payload, f'Missing/corrupt embedded {relative}'
    checks.append({'file': relative, 'sha256': hashlib.sha256(content).hexdigest()})
report = {'installer': installer.name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'peHeaderValid': True, 'nsisHeaderOffset': header, 'nsisHeaderSize': header_size, 'deflateBytesVerified': len(payload), 'crc32Valid': True, 'crcStart': crc_start, 'embeddedChecks': checks, 'signed': False, 'windowsExecuted': False}
(base/'evidence/installer-validation.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
