param(
  [Parameter(Mandatory = $true)][string]$Executable,
  [Parameter(Mandatory = $true)][string]$Icon,
  [switch]$VerifyOnly
)
$ErrorActionPreference = 'Stop'
$Executable = (Resolve-Path -LiteralPath $Executable).Path
$Icon = (Resolve-Path -LiteralPath $Icon).Path

Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.IO;
using System.Runtime.InteropServices;

public static class Win95IconResources {
  delegate bool NameCallback(IntPtr module, IntPtr type, IntPtr name, IntPtr parameter);
  delegate bool LanguageCallback(IntPtr module, IntPtr type, IntPtr name, ushort language, IntPtr parameter);

  [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern IntPtr BeginUpdateResource(string path, bool deleteExisting);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern bool UpdateResource(IntPtr handle, IntPtr type, IntPtr name, ushort language, byte[] data, uint size);
  [DllImport("kernel32.dll", SetLastError = true)]
  static extern bool EndUpdateResource(IntPtr handle, bool discard);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern IntPtr LoadLibraryEx(string path, IntPtr file, uint flags);
  [DllImport("kernel32.dll", SetLastError = true)]
  static extern bool FreeLibrary(IntPtr module);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern bool EnumResourceNames(IntPtr module, IntPtr type, NameCallback callback, IntPtr parameter);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern bool EnumResourceLanguages(IntPtr module, IntPtr type, IntPtr name, LanguageCallback callback, IntPtr parameter);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern IntPtr FindResourceEx(IntPtr module, IntPtr type, IntPtr name, ushort language);
  [DllImport("kernel32.dll", SetLastError = true)]
  static extern uint SizeofResource(IntPtr module, IntPtr resource);
  [DllImport("kernel32.dll", SetLastError = true)]
  static extern IntPtr LoadResource(IntPtr module, IntPtr resource);
  [DllImport("kernel32.dll", SetLastError = true)]
  static extern IntPtr LockResource(IntPtr resource);

  sealed class ResourceKey {
    public int Type;
    public int Id;
    public string Name;
    public ushort Language;
  }
  sealed class IconData {
    public byte[] Group;
    public List<byte[]> Images = new List<byte[]>();
  }

  static Win32Exception Error() { return new Win32Exception(Marshal.GetLastWin32Error()); }

  static IconData ReadIcon(string path) {
    byte[] bytes = File.ReadAllBytes(path);
    if (bytes.Length < 6 || BitConverter.ToUInt16(bytes, 0) != 0 || BitConverter.ToUInt16(bytes, 2) != 1)
      throw new InvalidDataException("Expected an ICO file.");
    int count = BitConverter.ToUInt16(bytes, 4);
    if (count == 0 || bytes.Length < 6 + count * 16) throw new InvalidDataException("Incomplete ICO directory.");
    IconData icon = new IconData { Group = new byte[6 + count * 14] };
    Array.Copy(bytes, icon.Group, 6);
    for (int i = 0; i < count; i++) {
      int entry = 6 + i * 16;
      uint length = BitConverter.ToUInt32(bytes, entry + 8);
      uint offset = BitConverter.ToUInt32(bytes, entry + 12);
      if (length == 0 || offset < 6 + count * 16 || (ulong)offset + length > (ulong)bytes.Length)
        throw new InvalidDataException("ICO image is outside the file.");
      byte[] image = new byte[length];
      Array.Copy(bytes, offset, image, 0, length);
      icon.Images.Add(image);
      Array.Copy(bytes, entry, icon.Group, 6 + i * 14, 12);
      Array.Copy(BitConverter.GetBytes((ushort)(i + 1)), 0, icon.Group, 6 + i * 14 + 12, 2);
    }
    return icon;
  }

  static List<ResourceKey> ExistingIcons(string path) {
    IntPtr module = LoadLibraryEx(path, IntPtr.Zero, 2);
    if (module == IntPtr.Zero) throw Error();
    List<ResourceKey> keys = new List<ResourceKey>();
    try {
      foreach (int type in new int[] { 3, 14 }) {
        NameCallback names = delegate(IntPtr m, IntPtr t, IntPtr n, IntPtr p) {
          bool numeric = ((ulong)n.ToInt64() >> 16) == 0;
          LanguageCallback languages = delegate(IntPtr lm, IntPtr lt, IntPtr ln, ushort language, IntPtr lp) {
            keys.Add(new ResourceKey { Type = type, Id = numeric ? n.ToInt32() : 0,
              Name = numeric ? null : Marshal.PtrToStringUni(n), Language = language });
            return true;
          };
          if (!EnumResourceLanguages(m, t, n, languages, IntPtr.Zero)) throw Error();
          return true;
        };
        if (!EnumResourceNames(module, new IntPtr(type), names, IntPtr.Zero)) {
          int error = Marshal.GetLastWin32Error();
          if (error != 1813 && error != 1814) throw new Win32Exception(error);
        }
      }
    } finally { FreeLibrary(module); }
    return keys;
  }

  public static void Set(string executable, string iconPath) {
    IconData icon = ReadIcon(iconPath);
    List<ResourceKey> old = ExistingIcons(executable);
    IntPtr update = BeginUpdateResource(executable, false);
    if (update == IntPtr.Zero) throw Error();
    bool committed = false;
    try {
      foreach (ResourceKey key in old) {
        IntPtr name = key.Name == null ? new IntPtr(key.Id) : Marshal.StringToHGlobalUni(key.Name);
        try {
          if (!UpdateResource(update, new IntPtr(key.Type), name, key.Language, null, 0)) throw Error();
        } finally { if (key.Name != null) Marshal.FreeHGlobal(name); }
      }
      for (int i = 0; i < icon.Images.Count; i++) {
        byte[] bytes = icon.Images[i];
        if (!UpdateResource(update, new IntPtr(3), new IntPtr(i + 1), 0, bytes, (uint)bytes.Length)) throw Error();
      }
      if (!UpdateResource(update, new IntPtr(14), new IntPtr(1), 0, icon.Group, (uint)icon.Group.Length)) throw Error();
      if (!EndUpdateResource(update, false)) throw Error();
      committed = true;
    } finally { if (!committed) EndUpdateResource(update, true); }
  }

  static byte[] Resource(IntPtr module, int type, int id) {
    IntPtr resource = FindResourceEx(module, new IntPtr(type), new IntPtr(id), 0);
    if (resource == IntPtr.Zero) throw Error();
    uint size = SizeofResource(module, resource);
    IntPtr loaded = LoadResource(module, resource);
    if (loaded == IntPtr.Zero) throw Error();
    IntPtr data = LockResource(loaded);
    if (data == IntPtr.Zero) throw Error();
    byte[] bytes = new byte[size];
    Marshal.Copy(data, bytes, 0, bytes.Length);
    return bytes;
  }

  static void Equal(byte[] actual, byte[] expected) {
    if (actual.Length != expected.Length) throw new InvalidDataException("Icon resource size differs.");
    for (int i = 0; i < actual.Length; i++)
      if (actual[i] != expected[i]) throw new InvalidDataException("Icon resource bytes differ.");
  }

  public static int Verify(string executable, string iconPath) {
    IconData icon = ReadIcon(iconPath);
    IntPtr module = LoadLibraryEx(executable, IntPtr.Zero, 2);
    if (module == IntPtr.Zero) throw Error();
    try {
      Equal(Resource(module, 14, 1), icon.Group);
      for (int i = 0; i < icon.Images.Count; i++) Equal(Resource(module, 3, i + 1), icon.Images[i]);
    } finally { FreeLibrary(module); }
    return icon.Images.Count;
  }
}
'@

if (-not $VerifyOnly) { [Win95IconResources]::Set($Executable, $Icon) }
$imageCount = [Win95IconResources]::Verify($Executable, $Icon)
Write-Output "Verified RT_GROUP_ICON and $imageCount RT_ICON images against $Icon"
