// Import necessary modules for testing
// Dynamic import Chai
const chai = import('chai');
const { expect } = chai;

// Now you can use Chai as usual
const { getmin } = require('./app')// Adjust the path accordingly


// Define test cases
describe('getmin function', () => {
    it('should return the remainder of current minutes divided by 5', () => {
        // Test case 1: Minutes divisible by 5
        const d1 = new Date();
        d1.setMinutes(30);
        const expected1 = 30 % 5;
        expect(getmin(d1)).to.equal(0);

        // Test case 2: Minutes not divisible by 5
        const d2 = new Date();
        d2.setMinutes(32);
        const expected2 = 32 % 5;
        expect(getmin(d2)).to.equal(expected2);
        
        // Test case 3: Edge case - minutes at midnight
        const d3 = new Date('2024-03-22T00:00:00');
        const expected3 = 0;
        expect(getmin(d3)).to.equal(expected3);
    });
});