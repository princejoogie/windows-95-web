export const help = {
  id: 'calculator',
  title: 'Calculator Help',
  contents: [
    {
      id: 'using',
      title: 'Using Calculator',
      body: 'Choose Standard or Scientific from the View menu. Click the keys or type numbers and arithmetic operators. Enter calculates the result. Escape clears the calculation, Delete clears the current entry, and Backspace removes the last typed digit.\n\nIn Standard view, operations run from left to right. Scientific view observes operator precedence. Use parentheses to group an expression. The (= indicator shows how many parentheses are open.',
      keywords: ['keyboard', 'standard', 'scientific', 'parentheses'],
    },
    {
      title: 'Scientific calculations',
      topics: [
        {
          id: 'functions',
          title: 'Functions and angles',
          body: 'Choose Degrees, Radians, or Grads before using sin, cos, or tan. Select Inv for the inverse function. Select Hyp for hyperbolic functions. Inv and Hyp together calculate inverse hyperbolic functions.\n\nx^2 and x^3 square and cube a number. Inv reverses these operations. Enter the first number, x^y, the second number, and equals to raise a number to a power. Inv with x^y calculates a root. ln and log use natural and base-ten logarithms. Inv calculates the corresponding exponential. n! calculates a nonnegative integer factorial.\n\nExp enters an exponent in scientific notation. Use +/- to change its sign. F-E switches the result display between ordinary and exponential notation. dms converts decimal angles to degrees, minutes, and seconds. Inv reverses the conversion. Int keeps the integer part. Inv keeps the fractional part.',
          keywords: ['trigonometry', 'powers', 'logarithms', 'exponents'],
        },
        {
          id: 'bases',
          title: 'Number bases and logical operations',
          body: 'Select Hex, Dec, Oct, or Bin to convert the displayed value and enter numbers in that base. A through F are available in Hex. Fractional parts are removed when switching from decimal to an integer base.\n\nDword, Word, and Byte use 32, 16, and 8 bits. Results outside that width wrap to the available bits. And, Or, Xor, and Not operate on those bits. Lsh shifts left by the next operand. Inv with Lsh shifts right. Mod finds the remainder after division.',
          keywords: ['hexadecimal', 'binary', 'octal', 'bits'],
        },
        {
          id: 'statistics',
          title: 'Statistics',
          body: 'Click Sta to open the Statistics Box. Enter each number in Calculator, then click Dat. The box shows the data and its count. Select a value and click LOAD to recall it in Calculator, CD to delete it, or CAD to clear all data. RET closes the box without discarding data.\n\nAve calculates the mean, Sum the sum, and s the sample standard deviation. Inv with Ave or Sum uses the squares of the data. Inv with s calculates the population standard deviation.',
          keywords: ['average', 'sum', 'deviation', 'data'],
        },
      ],
    },
    {
      id: 'memory',
      title: 'Memory and copying',
      body: 'MS stores the displayed number. MR recalls it. M+ adds the displayed number to memory. MC clears memory. The M indicator appears while memory is nonzero. C clears the calculation without clearing memory.\n\nUse Edit > Copy to copy the display and Edit > Paste to enter a number from the Clipboard.',
      keywords: ['clipboard', 'memory'],
    },
  ],
}
