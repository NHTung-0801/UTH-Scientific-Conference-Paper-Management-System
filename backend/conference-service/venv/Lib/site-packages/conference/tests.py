import unittest
from schedule import ConferenceManager

class TestStringMethods(unittest.TestCase):  
    def test_isEmpty(self):
        c = ConferenceManager('resource/test.txt')
        self.assertTrue(not c.talk_list)

    def test_isTime(self):
        c = ConferenceManager('resource/test3.txt')
        m=sum([c.totaltime(x) for x in c.morning])
        e=sum([c.totaltime(x) for x in c.evening])      
        self.assertTrue(m+e==c.total_time)

    def test_split(self):
        with self.assertRaises(Exception):
            c = ConferenceManager('resource/test2.txt')

if __name__ == '__main__':
    unittest.main()